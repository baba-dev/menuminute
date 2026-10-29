-- Receipt Atelier Phase B: additive, operator-attested POS payments without gateway or fiscal issuance.
-- This deliberately does NOT modify pos_finance_gates or issue a tax invoice.
CREATE TABLE pos_staff_payment_attestations (
  sale_id text PRIMARY KEY, organization_id text NOT NULL, outlet_id text NOT NULL,
  order_id text NOT NULL, actor_id text NOT NULL REFERENCES users(id),
  method text NOT NULL CHECK (method IN ('cash','upi_external','card_external','bank_external','other')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0), currency text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (outlet_id,sale_id) REFERENCES pos_sales(outlet_id,id),
  FOREIGN KEY (outlet_id,order_id) REFERENCES orders(restaurant_id,id),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
  UNIQUE (outlet_id,order_id)
);
ALTER TABLE pos_staff_payment_attestations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pos_staff_payment_attestations FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE FUNCTION app_private.pos_staff_payment_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Staff payment evidence is immutable' USING ERRCODE='42501'; END $$;
CREATE TRIGGER pos_staff_payment_immutable BEFORE UPDATE OR DELETE ON pos_staff_payment_attestations
FOR EACH ROW EXECUTE FUNCTION app_private.pos_staff_payment_immutable();

-- Never allow a second tender ledger capture for a staff-attested sale.
CREATE FUNCTION app_private.pos_staff_payment_double_collect_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM pos_staff_payment_attestations WHERE sale_id=NEW.sale_id AND outlet_id=NEW.outlet_id)
 THEN RAISE EXCEPTION 'Staff-paid sale must be reconciled before finance collection' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pos_staff_payment_no_double_tender BEFORE INSERT ON pos_tenders
FOR EACH ROW EXECUTE FUNCTION app_private.pos_staff_payment_double_collect_guard();

-- Existing idempotent menu/order/sale producer is reused in the SAME PostgreSQL statement.
-- Failure of the attestation rolls back the submitted order and its outbox/command record.
CREATE FUNCTION app_private.pos_submit_order_with_attestation(
 p_outlet text,p_key text,p_hash text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb; v_sale pos_sales%ROWTYPE; v_order orders%ROWTYPE;
 v_org text; v_method text; v_paid boolean; v_prior pos_staff_payment_attestations%ROWTYPE;
 v_actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF jsonb_typeof(p_data->'markAsPaid') IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'Invalid payment choice' USING ERRCODE='22023'; END IF;
 v_paid := (p_data->>'markAsPaid')::boolean;
 v_method := NULLIF(p_data->>'paymentMethod','');
 IF (v_paid AND v_method NOT IN ('cash','upi_external','card_external','bank_external','other'))
 OR (v_paid AND v_method IS NULL) OR (NOT v_paid AND v_method IS NOT NULL)
 THEN RAISE EXCEPTION 'Invalid staff payment method' USING ERRCODE='22023'; END IF;
 v_result:=app_private.pos_submit_order(p_outlet,p_key,p_hash,p_data);
 IF NOT v_paid THEN
  RETURN v_result || jsonb_build_object('paymentStatus','pending','paymentEvidence','none');
 END IF;
 SELECT * INTO v_sale FROM pos_sales WHERE id=v_result->>'saleId' AND outlet_id=p_outlet FOR UPDATE;
 IF NOT FOUND OR v_sale.origin<>'staff' THEN RAISE EXCEPTION 'Staff sale unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_order FROM orders WHERE id=v_sale.order_id AND restaurant_id=p_outlet FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_prior FROM pos_staff_payment_attestations
 WHERE sale_id=v_sale.id AND outlet_id=p_outlet;
 IF FOUND THEN
  IF v_prior.method IS DISTINCT FROM v_method OR v_prior.amount_minor<>v_sale.subtotal_minor
  OR v_prior.actor_id IS DISTINCT FROM v_actor OR v_order.payment_status<>'paid'
  THEN RAISE EXCEPTION 'Payment attestation conflict' USING ERRCODE='40001'; END IF;
 ELSE
  IF v_order.payment_status<>'unpaid' OR EXISTS(
   SELECT 1 FROM pos_bills WHERE sale_id=v_sale.id AND outlet_id=p_outlet)
   OR EXISTS(SELECT 1 FROM pos_tenders WHERE sale_id=v_sale.id AND outlet_id=p_outlet)
  THEN RAISE EXCEPTION 'Sale already settled or changed' USING ERRCODE='40001'; END IF;
  INSERT INTO pos_staff_payment_attestations(
   sale_id,organization_id,outlet_id,order_id,actor_id,method,amount_minor,currency)
  VALUES(v_sale.id,v_sale.organization_id,p_outlet,v_order.id,v_actor,v_method,v_sale.subtotal_minor,v_sale.currency);
  UPDATE orders SET payment_status='paid',version=version+1,updated_at=clock_timestamp()
  WHERE id=v_order.id AND restaurant_id=p_outlet AND payment_status='unpaid';
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale order payment' USING ERRCODE='40001'; END IF;
  INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
  VALUES(gen_random_uuid()::text,v_sale.organization_id,v_actor,'pos.staff_payment.attested',
   jsonb_build_object('saleId',v_sale.id,'orderId',v_order.id,'outletId',p_outlet,
   'method',v_method,'amountMinor',v_sale.subtotal_minor::text,'currency',v_sale.currency,
   'evidence','staff_recorded','taxCalculated',false));
  INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
  SELECT gen_random_uuid()::text,v_sale.organization_id,p_outlet,'order.payment_changed',1,version,
   jsonb_build_object('orderId',id,'paymentStatus','paid','evidence','staff_recorded')
  FROM orders WHERE id=v_order.id AND restaurant_id=p_outlet;
 END IF;
 RETURN v_result || jsonb_build_object('paymentStatus','complete',
  'paymentMethod',v_method,'paymentEvidence','staff_recorded');
END $$;
REVOKE ALL ON FUNCTION app_private.pos_submit_order_with_attestation(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_submit_order_with_attestation(text,text,text,jsonb) TO menuminute_app;

-- No fixed first-30 ceiling: bounded server-side pages, properly outlet scoped.
CREATE INDEX pos_receipt_recent_page ON pos_sales(outlet_id,created_at DESC,id DESC);
CREATE FUNCTION app_private.pos_recent_sales_page(p_outlet text,p_page integer) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_total bigint; v_items jsonb;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_page IS NULL OR p_page<0 OR p_page>1000 THEN RAISE EXCEPTION 'Invalid page' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO v_total FROM pos_sales WHERE outlet_id=p_outlet;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'saleId',x.id,'orderId',x.order_id,'orderNumber',o.order_number,
  'origin',x.origin,'currency',x.currency,'subtotalMinor',x.subtotal_minor::text,
  'status',o.status,'paymentStatus',o.payment_status,
  'createdAt',x.created_at) ORDER BY x.created_at DESC,x.id DESC),'[]'::jsonb)
 INTO v_items FROM (
  SELECT * FROM pos_sales WHERE outlet_id=p_outlet
  ORDER BY created_at DESC,id DESC LIMIT 10 OFFSET (p_page*10)
 ) x JOIN orders o ON o.id=x.order_id AND o.restaurant_id=p_outlet;
 RETURN jsonb_build_object('items',v_items,'page',p_page,'total',v_total,
  'hasMore',v_total>((p_page+1)*10));
END $$;
REVOKE ALL ON FUNCTION app_private.pos_recent_sales_page(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_recent_sales_page(text,integer) TO menuminute_app;

-- Private receipt snapshot, using server-only sale and line prices.
CREATE FUNCTION app_private.pos_receipt_data(p_outlet text,p_sale text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_sale pos_sales%ROWTYPE; v_order orders%ROWTYPE; v_seller pos_seller_profiles%ROWTYPE;
 v_attest pos_staff_payment_attestations%ROWTYPE; v_items jsonb; v_issued text;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_sale FROM pos_sales WHERE id=p_sale AND outlet_id=p_outlet;
 IF NOT FOUND THEN RAISE EXCEPTION 'Unknown sale' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_order FROM orders WHERE id=v_sale.order_id AND restaurant_id=p_outlet;
 SELECT * INTO v_seller FROM pos_seller_profiles WHERE outlet_id=p_outlet;
 SELECT * INTO v_attest FROM pos_staff_payment_attestations WHERE sale_id=p_sale AND outlet_id=p_outlet;
 SELECT id INTO v_issued FROM pos_documents WHERE sale_id=p_sale AND outlet_id=p_outlet
  AND kind IN ('invoice','receipt') ORDER BY issued_at LIMIT 1;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('name',l.name_snapshot,'variant',l.variant_snapshot,
  'quantity',l.quantity,'unitMinor',l.unit_minor::text,'lineMinor',l.line_minor::text)
  ORDER BY l.id),'[]'::jsonb) INTO v_items
 FROM pos_sale_lines l WHERE l.sale_id=p_sale AND l.outlet_id=p_outlet;
 RETURN jsonb_build_object('saleId',v_sale.id,'orderNumber',v_order.order_number,
  'createdAt',v_sale.created_at,'currency',v_sale.currency,'subtotalMinor',v_sale.subtotal_minor::text,
  'paymentStatus',CASE WHEN v_order.payment_status='paid' THEN 'complete' ELSE 'pending' END,
  'paymentEvidence',CASE WHEN v_attest.sale_id IS NOT NULL THEN 'staff_recorded' ELSE 'none' END,
  'paymentMethod',v_attest.method,'sellerName',v_seller.legal_name,
  'sellerAddress',v_seller.registered_address,'customerName',v_order.customer_name,
  'fulfillmentMode',v_order.fulfillment_mode,'items',v_items,'issuedDocumentId',v_issued);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_receipt_data(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_receipt_data(text,text) TO menuminute_app;
