-- POS #142 Phase F: operator-only, keyset-paged, full-history read-only consistency scan.
-- Visits staff-paid as well as operator-gated sales. Not bank reconciliation.
CREATE FUNCTION app_private.pos_reconciliation_page(
  p_outlet text, p_cursor_at timestamptz DEFAULT NULL,
  p_cursor_id text DEFAULT NULL, p_limit integer DEFAULT 100
) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_rows jsonb;
  v_anomalies jsonb;
  v_next_at timestamptz;
  v_next_id text;
  v_has_more boolean;
  v_scanned integer;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'close')
     OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
  THEN RAISE EXCEPTION 'Reconciliation access denied' USING ERRCODE='42501'; END IF;
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100
     OR (p_cursor_at IS NULL) <> (p_cursor_id IS NULL)
     OR (p_cursor_id IS NOT NULL AND length(p_cursor_id)>128)
  THEN RAISE EXCEPTION 'Invalid reconciliation page' USING ERRCODE='22023'; END IF;
  WITH candidates AS MATERIALIZED (
    SELECT id,created_at FROM pos_sales s WHERE s.outlet_id=p_outlet
      AND (p_cursor_at IS NULL OR (s.created_at,s.id)<(p_cursor_at,p_cursor_id))
    ORDER BY created_at DESC,id DESC LIMIT (p_limit+1)
  ), scanned AS MATERIALIZED (
    SELECT * FROM candidates ORDER BY created_at DESC,id DESC LIMIT p_limit
  ), first_pass AS (
    SELECT s.id,s.created_at,
      b.total_minor AS billed,
      s.subtotal_minor AS original_subtotal,
      a.amount_minor AS staff_paid,
      sf.amount_minor AS staff_refunded,
      o.payment_status,
      COALESCE((SELECT sum(t.amount_minor) FROM pos_tenders t
        WHERE t.outlet_id=p_outlet AND t.sale_id=s.id),0) AS tender_paid,
      COALESCE((SELECT sum(f.amount_minor) FROM pos_refunds f
        WHERE f.outlet_id=p_outlet AND f.sale_id=s.id),0) AS tender_refunded,
      COALESCE((SELECT sum((line.value->>'totalMinor')::bigint)
        FROM jsonb_array_elements(b.line_snapshot) line(value)),0) AS billed_lines
    FROM scanned c JOIN pos_sales s ON s.id=c.id AND s.outlet_id=p_outlet
    JOIN orders o ON o.id=s.order_id AND o.restaurant_id=p_outlet
    LEFT JOIN pos_bills b ON b.sale_id=s.id AND b.outlet_id=p_outlet
    LEFT JOIN pos_staff_payment_attestations a ON a.sale_id=s.id AND a.outlet_id=p_outlet
    LEFT JOIN pos_staff_refunds sf ON sf.sale_id=s.id AND sf.outlet_id=p_outlet
  ), anomalies AS (
    SELECT p.id AS sale_id,'collection_exceeds_bill'::text AS reason FROM first_pass p
    WHERE COALESCE(p.staff_paid,0)+p.tender_paid > COALESCE(p.billed,p.original_subtotal)
    UNION ALL
    SELECT p.id,'refund_exceeds_collection' FROM first_pass p
    WHERE COALESCE(p.staff_refunded,0)+p.tender_refunded >
      COALESCE(p.staff_paid,0)+p.tender_paid
    UNION ALL
    SELECT p.id,'bill_line_total_mismatch' FROM first_pass p
    WHERE p.billed IS NOT NULL AND p.billed_lines<>p.billed
    UNION ALL
    SELECT p.id,'staff_refund_status_mismatch' FROM first_pass p
    WHERE p.staff_refunded IS NOT NULL AND p.payment_status<>'voided'
    UNION ALL
    SELECT p.id,'staff_payment_status_mismatch' FROM first_pass p
    WHERE p.staff_paid IS NOT NULL AND p.staff_refunded IS NULL AND p.payment_status<>'paid'
    UNION ALL
    SELECT p.id,'finance_paid_status_mismatch' FROM first_pass p
    WHERE p.billed IS NOT NULL AND p.staff_paid IS NULL AND p.tender_paid>=p.billed
      AND p.tender_paid>0 AND p.payment_status<>'paid'
    UNION ALL
    SELECT pa.sale_id,'provider_attempt_needs_reconciliation' FROM pos_provider_attempts pa
      JOIN scanned s ON s.id=pa.sale_id
    WHERE pa.outlet_id=p_outlet AND pa.state IN ('preparing','uncertain')
    UNION ALL
    SELECT pa.sale_id,'provider_capture_missing_tender' FROM pos_provider_attempts pa
      JOIN scanned s ON s.id=pa.sale_id
    WHERE pa.outlet_id=p_outlet AND pa.kind='checkout' AND pa.state='succeeded'
      AND NOT EXISTS(SELECT 1 FROM pos_tenders t WHERE t.outlet_id=p_outlet
        AND t.sale_id=pa.sale_id AND t.method='stripe_checkout'
        AND t.reference=pa.external_payment_id)
    UNION ALL
    SELECT c.sale_id,'credit_document_missing' FROM pos_credit_groups c
      JOIN scanned s ON s.id=c.sale_id
    WHERE c.outlet_id=p_outlet AND c.state IN ('staff_recorded','provider_confirmed')
      AND c.document_id IS NULL
    UNION ALL
    SELECT d.sale_id,'document_delivery_needs_reconciliation'
    FROM pos_document_deliveries x JOIN pos_documents d
      ON d.id=x.document_id AND d.outlet_id=x.outlet_id
      JOIN scanned s ON s.id=d.sale_id
    WHERE x.outlet_id=p_outlet AND
      (x.state IN ('uncertain','failed') OR
       (x.state='pending' AND x.updated_at<now()-interval '5 minutes'))
  )
  SELECT COALESCE((SELECT jsonb_agg(jsonb_build_object(
       'saleId',a.sale_id,'reason',a.reason) ORDER BY a.sale_id,a.reason)
       FROM anomalies a),'[]'::jsonb),
       (SELECT count(*)::integer FROM scanned),
       EXISTS(SELECT 1 FROM candidates OFFSET p_limit LIMIT 1),
       (SELECT created_at FROM scanned ORDER BY created_at,id LIMIT 1),
       (SELECT id FROM scanned ORDER BY created_at,id LIMIT 1)
  INTO v_anomalies,v_scanned,v_has_more,v_next_at,v_next_id;
  RETURN jsonb_build_object(
    'outletId',p_outlet,'checkedAt',now(),'scannedCount',v_scanned,
    'pageLimit',p_limit,'hasMore',v_has_more,
    'nextCursorAt',CASE WHEN v_has_more THEN v_next_at ELSE NULL END,
    'nextCursorId',CASE WHEN v_has_more THEN v_next_id ELSE NULL END,
    'anomalies',v_anomalies,
    'complete',NOT v_has_more,
    'scope','local_ledger_invariants_only',
    'bankReconciliationVerified',false
  );
END $$;
REVOKE ALL ON FUNCTION app_private.pos_reconciliation_page(text,timestamptz,text,integer)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_reconciliation_page(text,timestamptz,text,integer)
  TO menuminute_app;

CREATE INDEX IF NOT EXISTS pos_staff_attest_outlet_date
  ON pos_staff_payment_attestations(outlet_id,created_at,id);
