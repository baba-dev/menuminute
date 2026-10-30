-- POS #142 D: full corrections for cashier-only Mark as Paid (not fiscal credits).
-- Finance gates stay OFF; payment evidence is never overwritten or promoted to gateway proof.
CREATE TABLE pos_staff_refunds (
  sale_id text PRIMARY KEY,
  organization_id text NOT NULL,
  outlet_id text NOT NULL,
  order_id text NOT NULL,
  actor_id text NOT NULL REFERENCES users(id),
  method text NOT NULL CHECK(method IN ('cash','upi_external','card_external','bank_external','other')),
  amount_minor bigint NOT NULL CHECK(amount_minor>0 AND amount_minor<=2147483647),
  currency text NOT NULL CHECK(length(currency)=3),
  reason text NOT NULL CHECK(length(btrim(reason)) BETWEEN 5 AND 200),
  external_refund_attested boolean NOT NULL,
  request_key text NOT NULL CHECK(request_key ~* '^[a-f0-9-]{36}$'),
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY(sale_id) REFERENCES pos_staff_payment_attestations(sale_id),
  FOREIGN KEY(outlet_id,sale_id) REFERENCES pos_sales(outlet_id,id),
  FOREIGN KEY(outlet_id,order_id) REFERENCES orders(restaurant_id,id),
  FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
  UNIQUE(outlet_id,request_key),
  CHECK((method='cash' AND NOT external_refund_attested)
      OR (method<>'cash' AND external_refund_attested))
);
CREATE INDEX pos_staff_refunds_outlet_time ON pos_staff_refunds(outlet_id,created_at DESC,sale_id);
ALTER TABLE pos_staff_refunds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pos_staff_refunds FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE TRIGGER pos_staff_refund_immutable BEFORE UPDATE OR DELETE ON pos_staff_refunds
FOR EACH ROW EXECUTE FUNCTION app_private.pos_staff_payment_immutable();

CREATE FUNCTION app_private.pos_staff_refund(
  p_outlet text,p_key text,p_hash text,p_sale text,p_reason text,p_external_attested boolean
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_sale pos_sales%ROWTYPE;
  v_staff pos_staff_payment_attestations%ROWTYPE;
  v_prior pos_staff_refunds%ROWTYPE;
  v_actor text := NULLIF(current_setting('app.actor_id',true),'');
  v_version integer;
  v_id text;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'refund')
    OR NOT app_private.can_outlet(p_outlet,'orders.read')
  THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  IF p_key IS NULL OR p_key !~* '^[a-f0-9-]{36}$'
     OR p_hash IS NULL OR p_hash !~ '^[a-f0-9]{64}$'
     OR length(btrim(COALESCE(p_reason,''))) NOT BETWEEN 5 AND 200
     OR p_external_attested IS NULL
  THEN RAISE EXCEPTION 'Invalid correction request' USING ERRCODE='22023'; END IF;
  -- Fast replay and independent post-lock replay prevent duplicate concurrent refunds.
  SELECT * INTO v_prior FROM pos_staff_refunds
  WHERE outlet_id=p_outlet AND request_key=p_key;
  IF FOUND THEN
    IF v_prior.sale_id<>p_sale OR v_prior.request_hash<>p_hash OR v_prior.actor_id<>v_actor
    THEN RAISE EXCEPTION 'Correction request conflict' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object('saleId',v_prior.sale_id,'refundId',v_prior.sale_id,
      'amountMinor',v_prior.amount_minor::text,'currency',v_prior.currency,
      'state','staff_refunded','duplicate',true);
  END IF;
  SELECT * INTO v_sale FROM pos_sales WHERE outlet_id=p_outlet AND id=p_sale FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Sale unavailable' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_staff FROM pos_staff_payment_attestations
  WHERE sale_id=p_sale AND outlet_id=p_outlet FOR UPDATE;
  IF NOT FOUND OR v_staff.order_id<>v_sale.order_id OR v_staff.currency<>v_sale.currency
  THEN RAISE EXCEPTION 'Staff attestation unavailable' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_prior FROM pos_staff_refunds WHERE outlet_id=p_outlet AND request_key=p_key;
  IF FOUND THEN
    IF v_prior.sale_id<>p_sale OR v_prior.request_hash<>p_hash OR v_prior.actor_id<>v_actor
    THEN RAISE EXCEPTION 'Correction request conflict' USING ERRCODE='40001'; END IF;
    RETURN jsonb_build_object('saleId',v_prior.sale_id,'refundId',v_prior.sale_id,
      'amountMinor',v_prior.amount_minor::text,'currency',v_prior.currency,
      'state','staff_refunded','duplicate',true);
  END IF;
  IF EXISTS(SELECT 1 FROM pos_staff_refunds WHERE sale_id=p_sale)
     OR EXISTS(SELECT 1 FROM pos_bills WHERE outlet_id=p_outlet AND sale_id=p_sale)
     OR EXISTS(SELECT 1 FROM pos_documents WHERE outlet_id=p_outlet AND sale_id=p_sale)
     OR EXISTS(SELECT 1 FROM pos_tenders WHERE outlet_id=p_outlet AND sale_id=p_sale)
  THEN RAISE EXCEPTION 'Sale correction requires reviewed finance reconciliation' USING ERRCODE='40001'; END IF;
  IF (v_staff.method='cash' AND p_external_attested)
     OR (v_staff.method<>'cash' AND NOT p_external_attested)
  THEN RAISE EXCEPTION 'External refund attestation mismatch' USING ERRCODE='22023'; END IF;
  -- The refund is one complete compensation for a pre-tax staff payment.
  UPDATE orders SET payment_status='voided', version=version+1,updated_at=clock_timestamp()
  WHERE restaurant_id=p_outlet AND id=v_sale.order_id AND payment_status='paid'
  RETURNING version INTO v_version;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operational payment state changed' USING ERRCODE='40001'; END IF;
  INSERT INTO pos_staff_refunds(sale_id,organization_id,outlet_id,order_id,actor_id,
    method,amount_minor,currency,reason,external_refund_attested,request_key,request_hash)
  VALUES(p_sale,v_sale.organization_id,p_outlet,v_sale.order_id,v_actor,
    v_staff.method,v_staff.amount_minor,v_staff.currency,btrim(p_reason),p_external_attested,p_key,p_hash);
  INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
  VALUES(gen_random_uuid()::text,v_sale.organization_id,v_actor,'pos.staff_payment.refunded',
    jsonb_build_object('saleId',p_sale,'orderId',v_sale.order_id,'outletId',p_outlet,
      'amountMinor',v_staff.amount_minor::text,'currency',v_staff.currency,
      'method',v_staff.method,'evidence','staff_refund_attested'));
  INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
  VALUES(gen_random_uuid()::text,v_sale.organization_id,p_outlet,'order.payment_changed',1,v_version,
    jsonb_build_object('orderId',v_sale.order_id,'paymentStatus','voided',
      'evidence','staff_refund_attested','saleId',p_sale));
  RETURN jsonb_build_object('saleId',p_sale,'refundId',p_sale,
    'amountMinor',v_staff.amount_minor::text,'currency',v_staff.currency,
    'state','staff_refunded','duplicate',false);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_staff_refund(text,text,text,text,text,boolean)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_staff_refund(text,text,text,text,text,boolean)
  TO menuminute_app;

-- Extend the protected settlement view rather than alter historical tender rows.
CREATE OR REPLACE FUNCTION app_private.pos_settlement_detail(p_outlet text, p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_sale pos_sales%ROWTYPE;
  v_order orders%ROWTYPE;
  v_bill pos_bills%ROWTYPE;
  v_staff pos_staff_payment_attestations%ROWTYPE;
  v_staff_refund pos_staff_refunds%ROWTYPE;
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
  SELECT * INTO v_staff_refund FROM pos_staff_refunds
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
  v_refunded := v_refunded + COALESCE(v_staff_refund.amount_minor,0);
  v_cash_refunded := v_cash_refunded + CASE WHEN v_staff_refund.method='cash'
    THEN COALESCE(v_staff_refund.amount_minor,0) ELSE 0 END;
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
    'staffRefundMinor',COALESCE(v_staff_refund.amount_minor,0)::text,
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

-- Private operational receipt distinguishes a reversed attestation from Pending.
CREATE FUNCTION app_private.pos_receipt_data_v2(p_outlet text,p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_data jsonb; v_refund pos_staff_refunds%ROWTYPE;
BEGIN
  v_data:=app_private.pos_receipt_data(p_outlet,p_sale);
  SELECT * INTO v_refund FROM pos_staff_refunds
  WHERE outlet_id=p_outlet AND sale_id=p_sale;
  IF FOUND THEN
    RETURN v_data || jsonb_build_object('paymentStatus','refunded',
      'refundRecorded',true);
  END IF;
  RETURN v_data || jsonb_build_object('refundRecorded',false);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_receipt_data_v2(text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_receipt_data_v2(text,text) TO menuminute_app;
