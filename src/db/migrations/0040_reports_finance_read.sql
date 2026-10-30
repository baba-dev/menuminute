-- Secured, read-only POS reporting projection. Never grant direct SELECT on finance tables.
CREATE FUNCTION app_private.reports_finance_snapshot(p_outlet text,p_from date,p_to date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_timezone text;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.can_outlet(p_outlet,'orders.read')
   OR p_from IS NULL OR p_to IS NULL OR p_to<p_from OR p_to-p_from>366
 THEN RAISE EXCEPTION 'Invalid reporting scope' USING ERRCODE='42501'; END IF;
 IF NOT app_private.pos_access(p_outlet,'close') THEN
   RETURN jsonb_build_object('available',false);
 END IF;
 SELECT timezone INTO v_timezone FROM restaurants WHERE id=p_outlet AND is_active;
 IF v_timezone IS NULL THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object(
  'available',true,
  'totalCollectedMinor',COALESCE((SELECT sum(amount_minor)::text FROM pos_tenders t
    WHERE t.outlet_id=p_outlet AND (t.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to),'0'),
  'totalRefundedMinor',COALESCE((SELECT sum(amount_minor)::text FROM pos_refunds f
    WHERE f.outlet_id=p_outlet AND (f.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to),'0'),
  'totalVarianceMinor',COALESCE((SELECT sum(counted_minor-expected_minor)::text FROM pos_shifts s
    WHERE s.outlet_id=p_outlet AND s.state='closed'
      AND (s.closed_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to),'0'),
  'tenders',COALESCE((SELECT jsonb_agg(jsonb_build_object('method',q.method,'tenderCount',q.n,'amountMinor',q.total) ORDER BY q.method)
    FROM (SELECT method,count(*)::int n,sum(amount_minor)::text total FROM pos_tenders t
      WHERE t.outlet_id=p_outlet AND (t.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to
      GROUP BY method) q),'[]'::jsonb),
  'shifts',COALESCE((SELECT jsonb_agg(jsonb_build_object('shiftId',q.id,'registerName',q.register_name,
       'cashierName',q.cashier_name,'state',q.state,'openedAt',q.opened_at,'closedAt',q.closed_at,
       'openingFloatMinor',q.opening_minor,'expectedMinor',q.expected_minor,'countedMinor',q.counted_minor,
       'cashTakenMinor',q.cash_taken,'cashRefundMinor',q.cash_refund) ORDER BY q.opened_at DESC,q.id DESC)
    FROM (SELECT s.id,s.register_name,COALESCE(u.name,'Operator') cashier_name,s.state,
       s.opened_at,s.closed_at,s.opening_minor::text,s.expected_minor::text,s.counted_minor::text,
       COALESCE((SELECT sum(t.amount_minor)::text FROM pos_tenders t WHERE t.shift_id=s.id AND t.method='cash'),'0') cash_taken,
       COALESCE((SELECT sum(f.amount_minor)::text FROM pos_refunds f JOIN pos_tenders t ON t.id=f.tender_id
         WHERE f.shift_id=s.id AND t.method='cash'),'0') cash_refund
       FROM pos_shifts s LEFT JOIN users u ON u.id=s.actor_id
       WHERE s.outlet_id=p_outlet
        AND ((CASE WHEN s.state='closed' THEN s.closed_at ELSE s.opened_at END) AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to
       ORDER BY s.opened_at DESC,s.id DESC LIMIT 25) q),'[]'::jsonb),
  'recentRefunds',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',q.id,'orderId',q.sale_id,
      'amountMinor',q.amount_minor,'reason',q.reason,'actorName',q.actor_name,
      'createdAt',q.created_at) ORDER BY q.created_at DESC,q.id DESC)
    FROM (SELECT f.id,f.sale_id,f.amount_minor::text,f.reason,COALESCE(u.name,'Staff') actor_name,f.created_at
      FROM pos_refunds f LEFT JOIN users u ON u.id=f.actor_id
      WHERE f.outlet_id=p_outlet AND (f.created_at AT TIME ZONE v_timezone)::date BETWEEN p_from AND p_to
      ORDER BY f.created_at DESC,f.id DESC LIMIT 20) q),'[]'::jsonb)
 );
END $$;
REVOKE ALL ON FUNCTION app_private.reports_finance_snapshot(text,date,date) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.reports_finance_snapshot(text,date,date) TO menuminute_app;
