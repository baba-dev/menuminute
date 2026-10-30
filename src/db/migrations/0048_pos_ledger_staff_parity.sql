-- POS #142 B follow-up: ledger totals include cashier attestations and immutable reversals.
-- Maintains the existing 60-row bound; complete historical reconciliation belongs to F.
-- Existing pos_ledger stays untouched for backward compatible callers.
CREATE FUNCTION app_private.pos_ledger_v2(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT app_private.pos_access(p_outlet,'ledger')
  THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'saleId',s.id,'orderId',s.order_id,'currency',s.currency,
      'subtotalMinor',s.subtotal_minor::text,
      'totalMinor',b.total_minor::text,'taxMinor',b.tax_minor::text,
      'paidMinor',(COALESCE(a.amount_minor,0)+COALESCE((
        SELECT sum(t.amount_minor) FROM pos_tenders t
        WHERE t.outlet_id=p_outlet AND t.sale_id=s.id
      ),0))::text,
      'refundedMinor',(COALESCE(sf.amount_minor,0)+COALESCE((
        SELECT sum(f.amount_minor) FROM pos_refunds f
        WHERE f.outlet_id=p_outlet AND f.sale_id=s.id
      ),0))::text,
      'paymentEvidence',CASE WHEN a.sale_id IS NOT NULL THEN 'staff_recorded'
        WHEN EXISTS(SELECT 1 FROM pos_tenders t WHERE t.outlet_id=p_outlet
          AND t.sale_id=s.id AND t.evidence='provider_confirmed')
          THEN 'provider_confirmed'
        WHEN EXISTS(SELECT 1 FROM pos_tenders t WHERE t.outlet_id=p_outlet
          AND t.sale_id=s.id) THEN 'finance_recorded' ELSE 'none' END,
      'staffRefunded',sf.sale_id IS NOT NULL,
      'documentNumber',(SELECT d.document_number FROM pos_documents d
        WHERE d.outlet_id=p_outlet AND d.sale_id=s.id
          AND d.kind IN ('receipt','invoice') LIMIT 1),
      'createdAt',s.created_at
    ) ORDER BY s.created_at DESC,s.id DESC)
    FROM (SELECT * FROM pos_sales WHERE outlet_id=p_outlet
       ORDER BY created_at DESC,id DESC LIMIT 60) s
    LEFT JOIN pos_bills b ON b.outlet_id=p_outlet AND b.sale_id=s.id
    LEFT JOIN pos_staff_payment_attestations a ON a.outlet_id=p_outlet AND a.sale_id=s.id
    LEFT JOIN pos_staff_refunds sf ON sf.outlet_id=p_outlet AND sf.sale_id=s.id
  ),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_ledger_v2(text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_ledger_v2(text) TO menuminute_app;
