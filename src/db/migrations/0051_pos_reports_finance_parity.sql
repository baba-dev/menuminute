-- POS #142 G: reports use same cashier + gated finance evidence as Ledger.
-- Staff cash has no shift ID and MUST NOT be quietly assigned to a drawer.
CREATE FUNCTION app_private.reports_finance_snapshot_v2(
 p_outlet text,p_from date,p_to date
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_snapshot jsonb;v_tz text;v_staff bigint;v_staff_ref bigint;
 v_cash bigint;v_cash_ref bigint;v_methods jsonb;v_staff_refunds jsonb;
BEGIN
 v_snapshot:=app_private.reports_finance_snapshot(p_outlet,p_from,p_to);
 IF (v_snapshot->>'available') IS DISTINCT FROM 'true' THEN RETURN v_snapshot; END IF;
 SELECT timezone INTO v_tz FROM restaurants WHERE id=p_outlet AND is_active;
 IF v_tz IS NULL THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT COALESCE(sum(amount_minor),0),
   COALESCE(sum(amount_minor) FILTER (WHERE method='cash'),0)
 INTO v_staff,v_cash FROM pos_staff_payment_attestations
 WHERE outlet_id=p_outlet AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to;
 SELECT COALESCE(sum(amount_minor),0),
   COALESCE(sum(amount_minor) FILTER (WHERE method='cash'),0)
 INTO v_staff_ref,v_cash_ref FROM pos_staff_refunds
 WHERE outlet_id=p_outlet AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'method','staff_'||method,'tenderCount',count_entries,'amountMinor',total::text)
   ORDER BY method),'[]'::jsonb)
 INTO v_methods FROM (
   SELECT method,count(*)::integer AS count_entries,sum(amount_minor) AS total
   FROM pos_staff_payment_attestations
   WHERE outlet_id=p_outlet AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to
   GROUP BY method
 ) methods;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'id',r.sale_id,'orderId',r.order_id,'amountMinor',r.amount_minor::text,
   'reason',r.reason,'actorName',COALESCE(u.name,'Staff'),'createdAt',r.created_at,
   'evidence','staff_refund_attested') ORDER BY r.created_at DESC,r.sale_id DESC),'[]'::jsonb)
 INTO v_staff_refunds
 FROM (SELECT * FROM pos_staff_refunds WHERE outlet_id=p_outlet
   AND (created_at AT TIME ZONE v_tz)::date BETWEEN p_from AND p_to
   ORDER BY created_at DESC,sale_id DESC LIMIT 20) r
 LEFT JOIN users u ON u.id=r.actor_id;
 RETURN v_snapshot || jsonb_build_object(
   'totalCollectedMinor',((v_snapshot->>'totalCollectedMinor')::bigint+v_staff)::text,
   'totalRefundedMinor',((v_snapshot->>'totalRefundedMinor')::bigint+v_staff_ref)::text,
   'financeCollectedMinor',v_snapshot->>'totalCollectedMinor',
   'financeRefundedMinor',v_snapshot->>'totalRefundedMinor',
   'staffCollectedMinor',v_staff::text,
   'staffRefundedMinor',v_staff_ref::text,
   'unassignedCashCollectedMinor',v_cash::text,
   'unassignedCashRefundedMinor',v_cash_ref::text,
   'unassignedNetCashMinor',(v_cash-v_cash_ref)::text,
   'unassignedCashExplanation','Staff-recorded cash has no shift assignment; excluded from drawer expected cash.',
   'tenders',COALESCE(v_snapshot->'tenders','[]'::jsonb) || v_methods,
   'recentRefunds',COALESCE(v_snapshot->'recentRefunds','[]'::jsonb) || v_staff_refunds,
   'financeAndStaffEvidenceCombined',true,
   'bankReconciliationVerified',false
 );
END $$;
REVOKE ALL ON FUNCTION app_private.reports_finance_snapshot_v2(text,date,date)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.reports_finance_snapshot_v2(text,date,date)
  TO menuminute_app;
