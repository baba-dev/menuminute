-- #315 Phase A/C: merchant-declared non-fiscal order tax with explicit opt-in.
-- The tax policy from #314 was originally PREVIEW ONLY. Existing configured
-- policies remain disabled by default; a new, confirmed live activation is required.
-- This migration is additive except for carefully wrapped canonical producers.
ALTER TABLE app_private.outlet_sales_tax_policies
  ADD COLUMN apply_to_orders boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN app_private.outlet_sales_tax_policies.apply_to_orders IS
 'Merchant explicitly opted in to non-fiscal tax collection. Existing profiles stay OFF.';

CREATE TABLE app_private.order_sales_tax_snapshots (
 order_id text PRIMARY KEY,
 outlet_id text NOT NULL,
 organization_id text NOT NULL,
 policy_revision integer NOT NULL CHECK(policy_revision>=0),
 policy_status text NOT NULL CHECK(policy_status IN ('unconfigured','no_tax','configured')),
 applied boolean NOT NULL,
 label text NOT NULL CHECK(length(label) BETWEEN 2 AND 40),
 rate_bps integer NOT NULL CHECK(rate_bps BETWEEN 0 AND 10000),
 inclusive boolean NOT NULL,
 currency text NOT NULL CHECK(length(currency)=3),
 original_subtotal_minor bigint NOT NULL CHECK(original_subtotal_minor BETWEEN 0 AND 2147483647),
 taxable_base_minor bigint NOT NULL CHECK(taxable_base_minor BETWEEN 0 AND 2147483647),
 tax_minor bigint NOT NULL CHECK(tax_minor BETWEEN 0 AND 2147483647),
 total_minor bigint NOT NULL CHECK(total_minor BETWEEN 0 AND 2147483647),
 line_snapshot jsonb NOT NULL CHECK(jsonb_typeof(line_snapshot)='array'),
 committed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY(outlet_id,order_id) REFERENCES orders(restaurant_id,id),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
 CONSTRAINT order_sales_tax_balance CHECK(taxable_base_minor+tax_minor=total_minor),
 CONSTRAINT order_sales_tax_none CHECK(applied OR tax_minor=0),
 CONSTRAINT order_sales_tax_active CHECK(
   NOT applied OR (policy_status='configured' AND rate_bps>0))
);
CREATE INDEX order_sales_tax_outlet_time ON app_private.order_sales_tax_snapshots
 (outlet_id,committed_at DESC,order_id);
ALTER TABLE app_private.order_sales_tax_snapshots ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON app_private.order_sales_tax_snapshots
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.order_sales_tax_immutable() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN RAISE EXCEPTION 'Committed tax snapshots are immutable' USING ERRCODE='42501'; END $$;
CREATE TRIGGER order_sales_tax_immutable BEFORE UPDATE OR DELETE
 ON app_private.order_sales_tax_snapshots FOR EACH ROW
 EXECUTE FUNCTION app_private.order_sales_tax_immutable();

-- Public policy is not an issued-tax assertion. Strict QR capability check;
-- no merchant internal identifiers, address, registration, or buyer data leak.
CREATE FUNCTION app_private.public_order_tax_policy(p_token text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_rest restaurants%ROWTYPE; p app_private.outlet_sales_tax_policies%ROWTYPE;
BEGIN
 SELECT rr.* INTO v_rest FROM restaurants rr JOIN qr_codes q ON q.restaurant_id=rr.id
 JOIN organizations o ON o.id=rr.organization_id
 WHERE q.destination_token=p_token AND q.is_active AND rr.is_active
 AND rr.is_published AND o.is_active LIMIT 1;
 IF NOT FOUND THEN RAISE EXCEPTION 'Published menu unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_sales_tax_policies WHERE outlet_id=v_rest.id;
 IF NOT FOUND THEN
   RETURN jsonb_build_object('revision',0,'status','unconfigured','label','Sales tax',
     'rateBps',0,'inclusive',false,'applied',false,'currency',v_rest.currency);
 END IF;
 RETURN jsonb_build_object('revision',p.revision,'status',p.status,'label',p.label,
   'rateBps',CASE WHEN p.apply_to_orders THEN p.rate_bps ELSE 0 END,
   'inclusive',p.inclusive,'applied',p.apply_to_orders,'currency',v_rest.currency);
END $$;
REVOKE ALL ON FUNCTION app_private.public_order_tax_policy(text)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.public_order_tax_policy(text) TO menuminute_app;

-- This function is private (no app EXECUTE): called only by the approved,
-- published menu / authorized POS producer wrapper in its original transaction.
-- The advisory transaction lock also guards the NO-ROW case from concurrent
-- first-time policy creation, using the exact same namespace as #314 saves.
CREATE FUNCTION app_private.commit_order_sales_tax(
 p_outlet text,p_order text,p_expected_revision integer,
 p_expected_total bigint,p_expected_tax bigint
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p app_private.outlet_sales_tax_policies%ROWTYPE;
 r restaurants%ROWTYPE; o orders%ROWTYPE; seller pos_seller_profiles%ROWTYPE;
 item record; v_status text:='unconfigured';v_label text:='Sales tax';
 v_rate bigint:=0;v_rev integer:=0;v_inclusive boolean:=false;v_applied boolean:=false;
 v_sub bigint:=0;v_base bigint:=0;v_tax bigint:=0;v_total bigint:=0;
 a bigint;b bigint;t bigint;due bigint;lines jsonb:='[]'::jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('outlet-sales-tax:'||p_outlet,0));
 SELECT * INTO o FROM orders WHERE id=p_order AND restaurant_id=p_outlet FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable for tax quote' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.order_sales_tax_snapshots
   WHERE order_id=p_order AND outlet_id=p_outlet)
 THEN RAISE EXCEPTION 'Tax snapshot already committed' USING ERRCODE='40001'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND is_active FOR SHARE;
 IF NOT FOUND OR r.currency<>o.currency THEN
   RAISE EXCEPTION 'Outlet currency changed' USING ERRCODE='40001'; END IF;
 SELECT * INTO p FROM app_private.outlet_sales_tax_policies
  WHERE outlet_id=p_outlet AND organization_id=r.organization_id FOR SHARE;
 IF FOUND THEN
   v_status:=p.status;v_label:=p.label;v_rev:=p.revision;
   v_inclusive:=p.inclusive;
   v_applied:=p.apply_to_orders AND p.status='configured';
   v_rate:=CASE WHEN v_applied THEN p.rate_bps ELSE 0 END;
 END IF;
 IF p_expected_revision IS DISTINCT FROM v_rev
   AND (v_applied OR p_expected_revision IS NOT NULL)
 THEN RAISE EXCEPTION 'Sales tax policy changed; review new total'
   USING ERRCODE='40001'; END IF;
 IF v_applied THEN
   SELECT * INTO seller FROM pos_seller_profiles WHERE outlet_id=p_outlet FOR SHARE;
   IF NOT FOUND OR seller.country<>r.country OR seller.tax_regime<>'requires_review'
      OR length(btrim(coalesce(seller.tax_registration,'')))<5
   THEN RAISE EXCEPTION 'Registered seller setup required before collecting sales tax'
      USING ERRCODE='40001'; END IF;
 END IF;
 FOR item IN SELECT i.id,i.dish_id,i.total_minor,i.quantity
 FROM order_items i WHERE i.order_id=p_order AND i.restaurant_id=p_outlet ORDER BY i.id LOOP
   a:=item.total_minor::bigint;
   IF a<0 OR item.quantity<=0 THEN RAISE EXCEPTION 'Invalid order line' USING ERRCODE='22023'; END IF;
   IF v_applied AND r.country='IN' AND NOT EXISTS(
     SELECT 1 FROM pos_tax_profiles profile JOIN pos_tax_classes c
       ON c.outlet_id=profile.outlet_id
     WHERE profile.outlet_id=p_outlet AND profile.mode='classified'
       AND profile.inclusive=v_inclusive AND c.dish_id=item.dish_id
       AND c.rate_bps=v_rate AND length(btrim(c.classification))>=4
   ) THEN RAISE EXCEPTION 'India GST item classification missing or inconsistent'
      USING ERRCODE='40001'; END IF;
   b:=CASE WHEN v_inclusive AND v_rate>0
     THEN (a*10000+(10000+v_rate)/2)/(10000+v_rate) ELSE a END;
   t:=CASE WHEN v_inclusive AND v_rate>0 THEN a-b
     ELSE (b*v_rate+5000)/10000 END;
   due:=b+t;
   v_sub:=v_sub+a;v_base:=v_base+b;v_tax:=v_tax+t;v_total:=v_total+due;
   IF v_sub>2147483647 OR v_total>2147483647
     THEN RAISE EXCEPTION 'Taxable order total is too large' USING ERRCODE='22003'; END IF;
   lines:=lines||jsonb_build_array(jsonb_build_object(
     'orderItemId',item.id,'dishId',item.dish_id,'quantity',item.quantity,
     'originalMinor',a::text,'baseMinor',b::text,'taxMinor',t::text,
     'totalMinor',due::text,'rateBps',v_rate));
 END LOOP;
 IF jsonb_array_length(lines)=0 OR v_sub<>o.subtotal_minor
 THEN RAISE EXCEPTION 'Committed order item totals do not reconcile' USING ERRCODE='40001'; END IF;
 IF (v_applied AND (p_expected_total IS NULL OR p_expected_tax IS NULL))
   OR (p_expected_total IS NOT NULL AND p_expected_total<>v_total)
   OR (p_expected_tax IS NOT NULL AND p_expected_tax<>v_tax)
 THEN RAISE EXCEPTION 'Sales tax quote changed; confirm updated total'
   USING ERRCODE='40001'; END IF;
 -- Demo orders are intentionally disposable: the authorized demo reset must
 -- delete its operational orders without persisting financial tax evidence.
 -- Real merchants always receive a protected immutable snapshot.
 IF NOT r.is_demo_data THEN
  INSERT INTO app_private.order_sales_tax_snapshots(
   order_id,outlet_id,organization_id,policy_revision,policy_status,applied,
   label,rate_bps,inclusive,currency,original_subtotal_minor,
   taxable_base_minor,tax_minor,total_minor,line_snapshot)
  VALUES(p_order,p_outlet,r.organization_id,v_rev,v_status,v_applied,
   v_label,v_rate,v_inclusive,r.currency,v_sub,v_base,v_tax,v_total,lines);
 END IF;
 UPDATE orders SET subtotal_minor=v_base::integer,subtotal_paise=v_base::integer,
  tax_minor=v_tax::integer,tax_paise=v_tax::integer,
  total_minor=v_total::integer,total_paise=v_total::integer
 WHERE id=p_order AND restaurant_id=p_outlet;
 -- The uncommitted event was prepared by the legacy canonical producer.
 -- Amend its amount before dispatch, rather than emitting two conflicting totals.
 UPDATE outbox_events SET payload=jsonb_set(payload,'{totalMinor}',to_jsonb(v_total),true)
 WHERE outlet_id=p_outlet AND type='order.created' AND aggregate_version=1
   AND payload->>'orderId'=p_order;
 RETURN jsonb_build_object('policyRevision',v_rev,'status',v_status,
   'taxAndFeesCalculated',v_applied,'label',v_label,'rateBps',v_rate,
   'inclusive',v_inclusive,'subtotalMinor',v_base::text,'taxMinor',v_tax::text,
   'totalMinor',v_total::text,'originalSubtotalMinor',v_sub::text,'applied',v_applied);
END $$;
REVOKE ALL ON FUNCTION
 app_private.commit_order_sales_tax(text,text,integer,bigint,bigint)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Preserve old production guest/POS validation, menu release checks,
-- idempotency, free-plan cap and kitchen dispatch, then finalize TAX in the
-- SAME transaction. Old functions are no longer callable by the app role.
ALTER FUNCTION app_private.submit_guest_order(text,jsonb)
 RENAME TO submit_guest_order_before_live_tax_0107;
REVOKE ALL ON FUNCTION app_private.submit_guest_order_before_live_tax_0107(text,jsonb)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.submit_guest_order(p_token text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE q qr_codes%ROWTYPE;v_result jsonb;v_tax jsonb;
BEGIN
 IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid guest order' USING ERRCODE='22023'; END IF;
 SELECT * INTO q FROM qr_codes WHERE destination_token=p_token AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Menu unavailable' USING ERRCODE='22023'; END IF;
 -- The legacy order producer is the authority for item prices, menu
 -- fingerprint, idempotency key, fulfillment, free cap and order ID.
 v_result:=app_private.submit_guest_order_before_live_tax_0107(
  p_token,jsonb_set(jsonb_set(p_payload,'{taxMinor}','0'::jsonb,true),
    '{totalMinor}',p_payload->'subtotalMinor',true)
 );
 IF COALESCE((v_result->>'isDuplicate')::boolean,false) THEN RETURN v_result; END IF;
 v_tax:=app_private.commit_order_sales_tax(
    q.restaurant_id,v_result->>'orderId',
    CASE WHEN p_payload ? 'expectedTaxRevision'
      THEN (p_payload->>'expectedTaxRevision')::integer ELSE NULL END,
    CASE WHEN p_payload ? 'totalMinor'
      THEN (p_payload->>'totalMinor')::bigint ELSE NULL END,
    CASE WHEN p_payload ? 'taxMinor'
      THEN (p_payload->>'taxMinor')::bigint ELSE NULL END
 );
 RETURN v_result||jsonb_build_object('totalMinor',(v_tax->>'totalMinor')::integer,
   'taxMinor',(v_tax->>'taxMinor')::integer,'taxRevision',v_tax->'policyRevision',
   'taxLabel',v_tax->'label','taxApplied',v_tax->'applied');
END $$;
REVOKE ALL ON FUNCTION app_private.submit_guest_order(text,jsonb)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.submit_guest_order(text,jsonb) TO menuminute_app;

ALTER FUNCTION app_private.pos_submit_order(text,text,text,jsonb)
 RENAME TO pos_submit_order_before_live_tax_0107;
REVOKE ALL ON FUNCTION app_private.pos_submit_order_before_live_tax_0107(text,text,text,jsonb)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.pos_submit_order(
  p_outlet text,p_key text,p_hash text,p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb;v_tax jsonb;v_actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid staff order' USING ERRCODE='22023'; END IF;
 v_result:=app_private.pos_submit_order_before_live_tax_0107(p_outlet,p_key,p_hash,p_data);
 IF COALESCE((v_result->>'duplicate')::boolean,false) THEN RETURN v_result; END IF;
 v_tax:=app_private.commit_order_sales_tax(
  p_outlet,v_result->>'orderId',
  CASE WHEN p_data ? 'expectedTaxRevision' THEN (p_data->>'expectedTaxRevision')::integer ELSE NULL END,
  CASE WHEN p_data ? 'expectedTotalMinor' THEN (p_data->>'expectedTotalMinor')::bigint ELSE NULL END,
  CASE WHEN p_data ? 'expectedTaxMinor' THEN (p_data->>'expectedTaxMinor')::bigint ELSE NULL END
 );
 v_result:=v_result||jsonb_build_object(
    'totalMinor',v_tax->'totalMinor','taxMinor',v_tax->'taxMinor',
    'subtotalMinor',v_tax->'originalSubtotalMinor',
    'taxRevision',v_tax->'policyRevision',
    'taxAndFeesCalculated',v_tax->'taxAndFeesCalculated',
    'taxApplied',v_tax->'applied','taxLabel',v_tax->'label');
 UPDATE pos_commands SET result=v_result
 WHERE outlet_id=p_outlet AND actor_id=v_actor AND request_key=p_key
    AND action='submit_order' AND request_hash=p_hash;
 IF NOT FOUND THEN RAISE EXCEPTION 'POS command evidence missing' USING ERRCODE='40001'; END IF;
 RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_submit_order(text,text,text,jsonb)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.pos_submit_order(text,text,text,jsonb) TO menuminute_app;

-- Refund and payment records refer to the original full payable, not
-- pre-tax pos_sales.subtotal_minor; this is essential for 0/2/3 ISO decimals
-- and inclusive/exclusive merchant tax. Preserve all existing attestation gates.
CREATE OR REPLACE FUNCTION app_private.pos_submit_order_with_attestation(
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
  IF v_prior.method IS DISTINCT FROM v_method OR v_prior.amount_minor<>v_order.total_minor
  OR v_prior.actor_id IS DISTINCT FROM v_actor OR v_order.payment_status<>'paid'
  THEN RAISE EXCEPTION 'Payment attestation conflict' USING ERRCODE='40001'; END IF;
 ELSE
  IF v_order.payment_status<>'unpaid' OR EXISTS(
   SELECT 1 FROM pos_bills WHERE sale_id=v_sale.id AND outlet_id=p_outlet)
   OR EXISTS(SELECT 1 FROM pos_tenders WHERE sale_id=v_sale.id AND outlet_id=p_outlet)
  THEN RAISE EXCEPTION 'Sale already settled or changed' USING ERRCODE='40001'; END IF;
  INSERT INTO pos_staff_payment_attestations(
   sale_id,organization_id,outlet_id,order_id,actor_id,method,amount_minor,currency)
  VALUES(v_sale.id,v_sale.organization_id,p_outlet,v_order.id,v_actor,v_method,v_order.total_minor,v_sale.currency);
  UPDATE orders SET payment_status='paid',version=version+1,updated_at=clock_timestamp()
  WHERE id=v_order.id AND restaurant_id=p_outlet AND payment_status='unpaid';
  IF NOT FOUND THEN RAISE EXCEPTION 'Stale order payment' USING ERRCODE='40001'; END IF;
  INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
  VALUES(gen_random_uuid()::text,v_sale.organization_id,v_actor,'pos.staff_payment.attested',
   jsonb_build_object('saleId',v_sale.id,'orderId',v_order.id,'outletId',p_outlet,
   'method',v_method,'amountMinor',v_order.total_minor::text,'currency',v_sale.currency,
   'evidence','staff_recorded','taxCalculated',v_order.tax_minor>0));
  INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
  SELECT gen_random_uuid()::text,v_sale.organization_id,p_outlet,'order.payment_changed',1,version,
   jsonb_build_object('orderId',id,'paymentStatus','paid','evidence','staff_recorded')
  FROM orders WHERE id=v_order.id AND restaurant_id=p_outlet;
 END IF;
 RETURN v_result || jsonb_build_object('paymentStatus','complete',
  'paymentMethod',v_method,'paymentEvidence','staff_recorded');
END $$;


-- Private non-fiscal receipt view uses frozen tax values, not today's policy.
-- Legacy/issued historical documents continue through their existing snapshots.
ALTER FUNCTION app_private.pos_receipt_data_v2(text,text)
 RENAME TO pos_receipt_data_v2_before_live_tax_0107;
REVOKE ALL ON FUNCTION app_private.pos_receipt_data_v2_before_live_tax_0107(text,text)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;
CREATE FUNCTION app_private.pos_receipt_data_v2(p_outlet text,p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb; snap app_private.order_sales_tax_snapshots%ROWTYPE;
BEGIN
 result:=app_private.pos_receipt_data_v2_before_live_tax_0107(p_outlet,p_sale);
 SELECT t.* INTO snap FROM pos_sales s
 JOIN app_private.order_sales_tax_snapshots t ON t.order_id=s.order_id AND t.outlet_id=s.outlet_id
 WHERE s.outlet_id=p_outlet AND s.id=p_sale;
 IF NOT FOUND THEN RETURN result||jsonb_build_object('taxApplied',false,
   'totalMinor',result->>'subtotalMinor','taxMinor','0'); END IF;
 RETURN result||jsonb_build_object(
  'taxApplied',snap.applied,'taxPolicyRevision',snap.policy_revision,
  'taxLabel',snap.label,'taxInclusive',snap.inclusive,
  'originalSubtotalMinor',snap.original_subtotal_minor::text,
  'taxableBaseMinor',snap.taxable_base_minor::text,
  'taxMinor',snap.tax_minor::text,'totalMinor',snap.total_minor::text,
  'taxLines',snap.line_snapshot
 );
END $$;
REVOKE ALL ON FUNCTION app_private.pos_receipt_data_v2(text,text)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.pos_receipt_data_v2(text,text) TO menuminute_app;

-- Finance bill-freezing cannot silently recalculate a different tax amount
-- against an already-accepted guest/POS tax snapshot.
CREATE FUNCTION app_private.pos_bill_live_tax_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s app_private.order_sales_tax_snapshots%ROWTYPE;
BEGIN
 SELECT snap.* INTO s FROM pos_sales sale
 JOIN app_private.order_sales_tax_snapshots snap
   ON snap.outlet_id=sale.outlet_id AND snap.order_id=sale.order_id
 WHERE sale.outlet_id=NEW.outlet_id AND sale.id=NEW.sale_id;
 IF FOUND AND s.applied AND (NEW.currency IS DISTINCT FROM s.currency
   OR NEW.subtotal_minor IS DISTINCT FROM s.original_subtotal_minor
   OR NEW.taxable_base_minor IS DISTINCT FROM s.taxable_base_minor
   OR NEW.tax_minor IS DISTINCT FROM s.tax_minor
   OR NEW.total_minor IS DISTINCT FROM s.total_minor)
 THEN RAISE EXCEPTION 'POS financial snapshot differs from committed merchant tax'
  USING ERRCODE='40001'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER pos_bill_live_tax_guard BEFORE INSERT ON pos_bills
 FOR EACH ROW EXECUTE FUNCTION app_private.pos_bill_live_tax_guard();
REVOKE ALL ON FUNCTION app_private.pos_bill_live_tax_guard()
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Backwards-compatible merchant API: a separately acknowledged choice activates
-- LIVE collection. Existing configured preview-only profiles remain off.
CREATE OR REPLACE FUNCTION app_private.read_outlet_sales_tax(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p app_private.outlet_sales_tax_policies%ROWTYPE;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.can_outlet(p_outlet,'menu.read')
   OR NOT EXISTS(SELECT 1 FROM restaurants WHERE organization_id=p_org AND id=p_outlet AND is_active)
 THEN RAISE EXCEPTION 'Outlet access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_sales_tax_policies WHERE outlet_id=p_outlet AND organization_id=p_org;
 IF NOT FOUND THEN
  RETURN jsonb_build_object('status','unconfigured','label','Sales tax','rateBps',0,
    'inclusive',false,'revision',0,'updatedAt',NULL,'canChangeOrders',false);
 END IF;
 RETURN jsonb_build_object('status',p.status,'label',p.label,'rateBps',p.rate_bps,
   'inclusive',p.inclusive,'revision',p.revision,'updatedAt',p.updated_at,
   'canChangeOrders',p.apply_to_orders);
END $$;

CREATE OR REPLACE FUNCTION app_private.save_outlet_sales_tax(
 p_org text,p_outlet text,p_expected integer,p_data jsonb
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE p app_private.outlet_sales_tax_policies%ROWTYPE; r restaurants%ROWTYPE;
 v_status text; v_label text;v_rate integer;v_inclusive boolean;
 v_revision integer;v_live boolean;v_actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.can_outlet(p_outlet,'outlet.manage')
   OR p_expected IS NULL OR p_expected<0 OR p_data IS NULL
   OR jsonb_typeof(p_data)<>'object'
   OR EXISTS (SELECT 1 FROM jsonb_object_keys(p_data) k(key)
      WHERE k.key NOT IN ('status','label','rateBps','inclusive','confirmed','applyToOrders','confirmedLiveTax'))
   OR p_data->>'status' NOT IN ('unconfigured','no_tax','configured')
   OR (p_data ? 'applyToOrders' AND jsonb_typeof(p_data->'applyToOrders') IS DISTINCT FROM 'boolean')
   OR (p_data ? 'confirmedLiveTax' AND jsonb_typeof(p_data->'confirmedLiveTax') IS DISTINCT FROM 'boolean')
   OR jsonb_typeof(p_data->'label') IS DISTINCT FROM 'string'
   OR jsonb_typeof(p_data->'rateBps') IS DISTINCT FROM 'number'
   OR COALESCE(p_data->>'rateBps','') !~ '^[0-9]{1,5}$'
   OR jsonb_typeof(p_data->'inclusive') IS DISTINCT FROM 'boolean'
   OR jsonb_typeof(p_data->'confirmed') IS DISTINCT FROM 'boolean'
   OR (p_data->>'confirmed')::boolean IS DISTINCT FROM true
 THEN RAISE EXCEPTION 'Invalid sales tax settings or outlet access' USING ERRCODE='42501'; END IF;
 v_status:=p_data->>'status';v_label:=btrim(p_data->>'label');
 v_rate:=(p_data->>'rateBps')::integer;v_inclusive:=(p_data->>'inclusive')::boolean;
 IF length(v_label) NOT BETWEEN 2 AND 40 OR v_rate NOT BETWEEN 0 AND 10000
   OR (v_status='configured' AND v_rate=0)
   OR (v_status<>'configured' AND v_rate<>0)
 THEN RAISE EXCEPTION 'Invalid tax label, status or rate' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('outlet-sales-tax:'||p_outlet,0));
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND organization_id=p_org
   AND is_active AND NOT is_demo_data FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_sales_tax_policies
   WHERE outlet_id=p_outlet AND organization_id=p_org FOR UPDATE;
 IF COALESCE(p.revision,0)<>p_expected THEN
  RAISE EXCEPTION 'Sales tax settings changed; reload and review' USING ERRCODE='40001'; END IF;
 v_live:=CASE WHEN p_data ? 'applyToOrders' THEN (p_data->>'applyToOrders')::boolean ELSE COALESCE(p.apply_to_orders,false) END;
 IF v_live AND (v_status<>'configured' OR (NOT COALESCE(p.apply_to_orders,false)
   AND (p_data->>'confirmedLiveTax') IS DISTINCT FROM 'true')) THEN
  RAISE EXCEPTION 'Explicit live tax collection consent required' USING ERRCODE='42501'; END IF;
 v_revision:=p_expected+1;
 INSERT INTO app_private.outlet_sales_tax_policies(
   outlet_id,organization_id,status,label,rate_bps,inclusive,apply_to_orders,revision,updated_by)
 VALUES(p_outlet,p_org,v_status,v_label,v_rate,v_inclusive,v_live,v_revision,v_actor)
 ON CONFLICT(outlet_id) DO UPDATE SET
   status=excluded.status,label=excluded.label,rate_bps=excluded.rate_bps,
   inclusive=excluded.inclusive,apply_to_orders=excluded.apply_to_orders,revision=excluded.revision,
   updated_by=excluded.updated_by,updated_at=clock_timestamp();
 INSERT INTO app_private.outlet_sales_tax_policy_history(
   outlet_id,revision,organization_id,status,label,rate_bps,inclusive,changed_by)
 VALUES(p_outlet,v_revision,p_org,v_status,v_label,v_rate,v_inclusive,v_actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,p_org,v_actor,'outlet.sales_tax.settings',
  jsonb_build_object('outletId',p_outlet,'revision',v_revision,'status',v_status,
    'rateBps',v_rate,'inclusive',v_inclusive,'appliedToOrders',v_live));
 RETURN jsonb_build_object('status',v_status,'label',v_label,'rateBps',v_rate,
   'inclusive',v_inclusive,'revision',v_revision,'updatedAt',clock_timestamp(),
   'canChangeOrders',v_live);
END $$;


-- A cashier/service staff member may quote tax without permission to edit it.
-- This mirrors POS sale authorization rather than the merchant settings role.
CREATE FUNCTION app_private.pos_order_tax_policy(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; p app_private.outlet_sales_tax_policies%ROWTYPE;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
   OR NOT app_private.pos_access(p_outlet,'sale')
 THEN RAISE EXCEPTION 'POS tax quote access denied' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND is_active;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM app_private.outlet_sales_tax_policies
 WHERE outlet_id=p_outlet AND organization_id=r.organization_id;
 IF NOT FOUND THEN RETURN jsonb_build_object(
   'revision',0,'status','unconfigured','label','Sales tax',
   'rateBps',0,'inclusive',false,'applied',false,'currency',r.currency);
 END IF;
 RETURN jsonb_build_object('revision',p.revision,'status',p.status,
   'label',p.label,'rateBps',CASE WHEN p.apply_to_orders THEN p.rate_bps ELSE 0 END,
   'inclusive',p.inclusive,'applied',p.apply_to_orders,'currency',r.currency);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_order_tax_policy(text)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.pos_order_tax_policy(text) TO menuminute_app;
