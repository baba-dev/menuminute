-- POS #142 Phase B: one guarded accounting read spanning both existing payment sources.
-- No write capability, historical backfill, provider activation or statutory claim.
CREATE FUNCTION app_private.pos_settlement_detail(p_outlet text, p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_sale pos_sales%ROWTYPE;
  v_order orders%ROWTYPE;
  v_bill pos_bills%ROWTYPE;
  v_staff pos_staff_payment_attestations%ROWTYPE;
  v_tender bigint := 0; v_cash_tender bigint := 0;
  v_provider bigint := 0; v_refunded bigint := 0; v_cash_refunded bigint := 0;
  v_assigned bigint; v_expected bigint; v_net bigint;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'read')
    OR NOT app_private.can_outlet(p_outlet,'orders.read')
  THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_sale FROM pos_sales WHERE outlet_id=p_outlet AND id=p_sale;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale unavailable' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM orders WHERE id=v_sale.order_id AND restaurant_id=p_outlet;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_bill FROM pos_bills WHERE outlet_id=p_outlet AND sale_id=p_sale;
  SELECT * INTO v_staff FROM pos_staff_payment_attestations
  WHERE outlet_id=p_outlet AND sale_id=p_sale;
  SELECT COALESCE(sum(amount_minor),0),
    COALESCE(sum(amount_minor) FILTER (WHERE method='cash'),0),
    COALESCE(sum(amount_minor) FILTER (WHERE evidence='provider_confirmed'),0)
    INTO v_tender,v_cash_tender,v_provider
  FROM pos_tenders WHERE outlet_id=p_outlet AND sale_id=p_sale;
  SELECT COALESCE(sum(f.amount_minor),0),
    COALESCE(sum(f.amount_minor) FILTER (WHERE t.method='cash'),0)
    INTO v_refunded,v_cash_refunded
  FROM pos_refunds f JOIN pos_tenders t
    ON t.outlet_id=f.outlet_id AND t.sale_id=f.sale_id AND t.id=f.tender_id
  WHERE f.outlet_id=p_outlet AND f.sale_id=p_sale;
  v_expected := COALESCE(v_bill.total_minor,v_sale.subtotal_minor);
  v_assigned := COALESCE(v_staff.amount_minor,0) + v_tender;
  v_net := v_assigned - v_refunded;
  RETURN jsonb_build_object(
    'saleId',v_sale.id,'orderId',v_sale.order_id,'currency',v_sale.currency,
    'basis',CASE WHEN v_bill.sale_id IS NULL THEN 'pre_tax_draft' ELSE 'frozen_bill' END,
    'expectedMinor',v_expected::text,
    'staffAttestedMinor',COALESCE(v_staff.amount_minor,0)::text,
    'staffMethod',v_staff.method,
    'financeTenderMinor',v_tender::text,
    'providerConfirmedMinor',v_provider::text,
    'cashCollectedMinor',(v_cash_tender+CASE WHEN v_staff.method='cash' THEN COALESCE(v_staff.amount_minor,0) ELSE 0 END)::text,
    'refundMinor',v_refunded::text,'cashRefundMinor',v_cash_refunded::text,
    'recordedNetMinor',v_net::text,
    'unallocatedOriginalMinor',GREATEST(v_expected-v_assigned,0)::text,
    'state',CASE WHEN v_refunded>0 AND v_net=0 THEN 'refunded'
      WHEN v_refunded>0 THEN 'partially_refunded'
      WHEN v_assigned=0 THEN 'unpaid'
      WHEN v_assigned<v_expected THEN 'partial'
      ELSE 'paid' END,
    'orderPaymentStatus',v_order.payment_status,
    'staffEvidenceIsProviderConfirmed',false,
    'providerReconciliationVerified',false,
    'taxOrFiscalApprovalInferred',false
  );
END $$;
REVOKE ALL ON FUNCTION app_private.pos_settlement_detail(text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_settlement_detail(text,text) TO menuminute_app;
