-- Custom migration: 0006_online_ordering.sql
-- Implements canonical online ordering columns, constraints, and daily sequence generator

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_mode" text NOT NULL DEFAULT 'dine_in';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'unpaid';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'INR';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "client_submission_key" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_token" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_submission_key_idx" ON "orders" ("restaurant_id", "client_submission_key") WHERE "client_submission_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tracking_token_idx" ON "orders" ("tracking_token") WHERE "tracking_token" IS NOT NULL;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "dish_id" text NOT NULL DEFAULT '';
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "selected_options" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit_price_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "total_minor" integer NOT NULL DEFAULT 0;

ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "from_status" text;
ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "to_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "actor_type" text NOT NULL DEFAULT 'system';
ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "actor_id" text;

-- Daily scoped sequence counter table in app_private schema
CREATE TABLE IF NOT EXISTS app_private.order_counters (
  restaurant_id text NOT NULL,
  business_date date NOT NULL,
  last_order_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, business_date)
);

CREATE OR REPLACE FUNCTION app_private.next_order_number(p_restaurant_id text, p_business_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_num integer;
BEGIN
  INSERT INTO app_private.order_counters(restaurant_id, business_date, last_order_number)
  VALUES(p_restaurant_id, p_business_date, 1)
  ON CONFLICT (restaurant_id, business_date)
  DO UPDATE SET last_order_number = app_private.order_counters.last_order_number + 1
  RETURNING last_order_number INTO v_num;
  RETURN v_num;
END $$;

REVOKE ALL ON FUNCTION app_private.next_order_number(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.next_order_number(text, date) TO menuminute_app;


-- Versioned menu dishes are JSON-document identities, not necessarily legacy menu_items rows.
ALTER TABLE order_items ALTER COLUMN menu_item_id DROP NOT NULL;

-- New ordering contract: preserve existing history and use narrowly scoped SECURITY DEFINER commands.
ALTER TABLE orders ADD COLUMN IF NOT EXISTS request_hash text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS business_date date;
UPDATE orders SET subtotal_minor=subtotal_paise,tax_minor=tax_paise,total_minor=total_paise,
business_date=(created_at AT TIME ZONE COALESCE((SELECT timezone FROM restaurants WHERE id=orders.restaurant_id),'UTC'))::date
WHERE client_submission_key IS NULL;
UPDATE orders SET status=CASE status WHEN 'confirmed' THEN 'accepted' WHEN 'delivered' THEN 'served' ELSE status END
WHERE client_submission_key IS NULL;
UPDATE order_items SET dish_id=COALESCE(NULLIF(dish_id,''),menu_item_id),
unit_price_minor=unit_price_paise,total_minor=total_paise;
UPDATE order_status_events SET to_status=CASE status WHEN 'confirmed' THEN 'accepted' WHEN 'delivered' THEN 'served' ELSE status END
WHERE to_status='pending' AND status<>'pending';
CREATE INDEX IF NOT EXISTS orders_pending_expiry_idx ON orders(expires_at) WHERE status='pending';

CREATE OR REPLACE FUNCTION app_private.next_order_number(p_restaurant_id text,p_business_date date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_num integer;
BEGIN
 INSERT INTO app_private.order_counters(restaurant_id,business_date,last_order_number)
 VALUES(p_restaurant_id,p_business_date,
  (SELECT COALESCE(MAX(order_number),0)+1 FROM orders WHERE restaurant_id=p_restaurant_id AND business_date=p_business_date))
 ON CONFLICT(restaurant_id,business_date)
 DO UPDATE SET last_order_number=app_private.order_counters.last_order_number+1
 RETURNING last_order_number INTO v_num;
 RETURN v_num;
END $$;
REVOKE ALL ON FUNCTION app_private.next_order_number(text,date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.next_order_number(text,date) TO menuminute_app;

CREATE FUNCTION app_private.submit_guest_order(p_token text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE q qr_codes%ROWTYPE; r restaurants%ROWTYPE; o organizations%ROWTYPE; prior orders%ROWTYPE;
 v_catalog jsonb; v_date date; v_number integer; v_id text; v_tracking text; v_item jsonb;
 v_sum bigint:=0; v_item_total bigint; v_qty integer; v_unit integer; v_key text:=p_payload->>'clientSubmissionKey';
BEGIN
 IF length(p_token) NOT BETWEEN 1 AND 128 OR v_key IS NULL OR length(v_key)>128
   OR p_payload->>'requestHash' !~ '^[0-9a-f]{64}$' THEN
   RAISE EXCEPTION 'Invalid submission' USING ERRCODE='22023';
 END IF;
 SELECT * INTO q FROM qr_codes WHERE destination_token=p_token AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Menu unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=q.restaurant_id AND is_active AND is_published FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM organizations WHERE id=r.organization_id AND is_active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(r.id||':'||v_key,0));
 SELECT * INTO prior FROM orders WHERE restaurant_id=r.id AND client_submission_key=v_key FOR UPDATE;
 IF FOUND THEN
   IF prior.request_hash IS DISTINCT FROM p_payload->>'requestHash' THEN
     RAISE EXCEPTION 'Submission key reused with different cart' USING ERRCODE='22023';
   END IF;
   RETURN jsonb_build_object('orderId',prior.id,'trackingToken',prior.tracking_token,
   'orderNumber',prior.order_number,'status',prior.status,'totalMinor',prior.total_minor,
   'currency',prior.currency,'isDuplicate',true);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.organization_id=o.id AND g.capability='ordering.new'
 AND g.revoked_at IS NULL AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp()) THEN
   RAISE EXCEPTION 'Online ordering is not enabled for this outlet' USING ERRCODE='42501';
 END IF;
 IF NOT (p_payload->>'fulfillmentMode'=ANY(r.fulfillment_modes)) THEN
   RAISE EXCEPTION 'Unsupported fulfillment mode' USING ERRCODE='22023';
 END IF;
 v_catalog:=app_private.free_menu_public(p_token);
 IF v_catalog IS NULL OR NOT (v_catalog->'outlet'->>'versioned')::boolean
    OR md5((v_catalog->'menus')::text) IS DISTINCT FROM p_payload->>'catalogFingerprint' THEN
   RAISE EXCEPTION 'The menu changed; please review your cart' USING ERRCODE='40001';
 END IF;
 IF (p_payload->>'expiresAt')::timestamptz<=clock_timestamp() OR
    (p_payload->>'expiresAt')::timestamptz>clock_timestamp()+interval '2 hours' THEN
   RAISE EXCEPTION 'Invalid service expiry' USING ERRCODE='22023';
 END IF;
 IF jsonb_typeof(p_payload->'items') IS DISTINCT FROM 'array' OR jsonb_array_length(p_payload->'items') NOT BETWEEN 1 AND 50 THEN
   RAISE EXCEPTION 'Invalid items' USING ERRCODE='22023';
 END IF;
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
   v_qty:=(v_item->>'quantity')::integer; v_unit:=(v_item->>'unitPriceMinor')::integer;
   v_item_total:=(v_item->>'totalMinor')::bigint;
   IF v_qty NOT BETWEEN 1 AND 99 OR v_unit<0 OR v_item_total<>(v_qty::bigint*v_unit) THEN
     RAISE EXCEPTION 'Invalid item totals' USING ERRCODE='22023';
   END IF;
   v_sum:=v_sum+v_item_total;
 END LOOP;
 IF v_sum>2147483647 OR v_sum<>(p_payload->>'subtotalMinor')::bigint
 OR v_sum<>(p_payload->>'totalMinor')::bigint OR (p_payload->>'taxMinor')::integer<>0 THEN
   RAISE EXCEPTION 'Invalid order totals' USING ERRCODE='22023';
 END IF;
 v_id:='ord-'||gen_random_uuid()::text; v_tracking:='trk-'||gen_random_uuid()::text;
 v_date:=(clock_timestamp() AT TIME ZONE r.timezone)::date;
 v_number:=app_private.next_order_number(r.id,v_date);
 INSERT INTO orders(id,restaurant_id,table_id,customer_name,customer_phone,fulfillment_mode,
 status,payment_status,currency,subtotal_minor,tax_minor,total_minor,subtotal_paise,tax_paise,total_paise,
 notes,client_submission_key,request_hash,tracking_token,expires_at,business_date,order_number,version)
 VALUES(v_id,r.id,CASE WHEN p_payload->>'fulfillmentMode'='dine_in' THEN q.table_id ELSE NULL END,
 NULLIF(p_payload->>'customerName',''),NULLIF(p_payload->>'customerPhone',''),p_payload->>'fulfillmentMode',
 'pending','unpaid',r.currency,v_sum,0,v_sum,v_sum,0,v_sum,NULLIF(p_payload->>'notes',''),
 v_key,p_payload->>'requestHash',v_tracking,(p_payload->>'expiresAt')::timestamptz,v_date,v_number,1);
 FOR v_item IN SELECT value FROM jsonb_array_elements(p_payload->'items') LOOP
   INSERT INTO order_items(id,order_id,restaurant_id,menu_item_id,dish_id,variant_id,item_name,
     variant_name,selected_options,unit_price_minor,total_minor,unit_price_paise,total_paise,quantity,notes)
   VALUES(gen_random_uuid()::text,v_id,r.id,NULL,v_item->>'dishId',
   NULLIF(v_item->>'variantId',''),v_item->>'dishName',NULLIF(v_item->>'variantName',''),
   COALESCE(v_item->'selectedOptions','[]'::jsonb),(v_item->>'unitPriceMinor')::integer,
   (v_item->>'totalMinor')::integer,(v_item->>'unitPriceMinor')::integer,
   (v_item->>'totalMinor')::integer,(v_item->>'quantity')::integer,NULLIF(v_item->>'notes',''));
 END LOOP;
 INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type)
 VALUES(gen_random_uuid()::text,v_id,r.id,NULL,'pending','pending','Order submitted by guest','guest');
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,o.id,r.id,'order.created',1,1,
 jsonb_build_object('orderId',v_id,'orderNumber',v_number,'totalMinor',v_sum,'currency',r.currency));
 RETURN jsonb_build_object('orderId',v_id,'trackingToken',v_tracking,'orderNumber',v_number,
 'status','pending','totalMinor',v_sum,'currency',r.currency,'isDuplicate',false);
END $$;
REVOKE ALL ON FUNCTION app_private.submit_guest_order(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.submit_guest_order(text,jsonb) TO menuminute_app;

CREATE FUNCTION app_private.track_guest_order(p_token text,p_order text,p_tracking text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_order orders%ROWTYPE; v_outlet restaurants%ROWTYPE; v_point text; v_items jsonb; v_events jsonb;
BEGIN
 SELECT r.* INTO v_outlet FROM qr_codes q JOIN restaurants r ON r.id=q.restaurant_id
 JOIN organizations org ON org.id=r.organization_id
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND org.is_active LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO v_order FROM orders
 WHERE id=p_order AND restaurant_id=v_outlet.id AND tracking_token=p_tracking;
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT t.label INTO v_point FROM qr_codes q LEFT JOIN restaurant_tables t ON t.id=q.table_id AND t.restaurant_id=v_outlet.id
 WHERE q.destination_token=p_token;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',i.id,'itemName',i.item_name,'variantName',i.variant_name,
   'selectedOptions',i.selected_options,'unitPriceMinor',i.unit_price_minor,'totalMinor',i.total_minor,
   'quantity',i.quantity,'notes',i.notes)),'[]'::jsonb) INTO v_items
 FROM order_items i WHERE i.order_id=v_order.id AND i.restaurant_id=v_outlet.id;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',e.id,'fromStatus',e.from_status,'toStatus',e.to_status,
   'note',e.note,'createdAt',e.created_at) ORDER BY e.created_at,e.id),'[]'::jsonb) INTO v_events
 FROM order_status_events e WHERE e.order_id=v_order.id AND e.restaurant_id=v_outlet.id;
 RETURN jsonb_build_object('order',jsonb_build_object('id',v_order.id,'orderNumber',v_order.order_number,
   'status',v_order.status,'paymentStatus',v_order.payment_status,'fulfillmentMode',v_order.fulfillment_mode,
   'currency',v_order.currency,'subtotalMinor',v_order.subtotal_minor,'taxMinor',v_order.tax_minor,
   'totalMinor',v_order.total_minor,'notes',v_order.notes,'rejectionReason',v_order.rejection_reason,
   'createdAt',v_order.created_at,'updatedAt',v_order.updated_at,'point',v_point),
   'outlet',jsonb_build_object('name',v_outlet.name,'currency',v_outlet.currency),
   'items',v_items,'events',v_events);
END $$;
REVOKE ALL ON FUNCTION app_private.track_guest_order(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.track_guest_order(text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.transition_order(p_outlet text,p_order text,p_target text,
 p_expected integer,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v orders%ROWTYPE; v_org text; v_permission text;
BEGIN
 v_permission:=CASE WHEN p_target='preparing' THEN 'orders.prepare'
 WHEN p_target IN ('ready','served','collected') THEN 'orders.complete'
 WHEN p_target IN ('rejected','cancelled') THEN 'orders.cancel' ELSE 'orders.accept' END;
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,v_permission) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v FROM orders WHERE id=p_order AND restaurant_id=p_outlet FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE='22023'; END IF;
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;
 IF v.status='pending' AND v.expires_at<=clock_timestamp() THEN
   UPDATE orders SET status='expired',version=version+1,updated_at=clock_timestamp() WHERE id=v.id;
   INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type)
   VALUES(gen_random_uuid()::text,v.id,p_outlet,'pending','expired','expired','Acceptance window elapsed','system');
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   VALUES(gen_random_uuid()::text,v_org,p_outlet,'order.status_changed',1,v.version+1,
     jsonb_build_object('orderId',v.id,'fromStatus','pending','toStatus','expired'));
   RETURN jsonb_build_object('expired',true,'currentStatus','expired');
 END IF;
 IF v.version<>p_expected THEN RAISE EXCEPTION 'Stale order version' USING ERRCODE='40001'; END IF;
 IF NOT ((v.status='pending' AND p_target IN ('accepted','rejected'))
 OR (v.status='accepted' AND p_target IN ('preparing','cancelled'))
 OR (v.status='preparing' AND p_target IN ('ready','cancelled'))
 OR (v.status='ready' AND (p_target='cancelled' OR
    (v.fulfillment_mode='pickup' AND p_target='collected') OR
    (v.fulfillment_mode='dine_in' AND p_target='served')))) THEN
   RAISE EXCEPTION 'Invalid order transition' USING ERRCODE='22023';
 END IF;
 UPDATE orders SET status=p_target,version=v.version+1,updated_at=clock_timestamp(),
 rejection_reason=CASE WHEN p_target IN ('rejected','cancelled') THEN NULLIF(p_reason,'') ELSE rejection_reason END
 WHERE id=v.id AND restaurant_id=p_outlet AND version=p_expected AND status=v.status;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale order version' USING ERRCODE='40001'; END IF;
 INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
 VALUES(gen_random_uuid()::text,v.id,p_outlet,v.status,p_target,p_target,
 COALESCE(NULLIF(p_reason,''),'Status updated to '||p_target),'staff',current_setting('app.actor_id',true));
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,v_org,p_outlet,'order.status_changed',1,v.version+1,
 jsonb_build_object('orderId',v.id,'fromStatus',v.status,'toStatus',p_target));
 RETURN jsonb_build_object('success',true,'orderId',v.id,'previousStatus',v.status,
 'currentStatus',p_target,'version',v.version+1);
END $$;
REVOKE ALL ON FUNCTION app_private.transition_order(text,text,text,integer,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.transition_order(text,text,text,integer,text) TO menuminute_app;

CREATE FUNCTION app_private.expire_pending_orders()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v record; v_count integer:=0;
BEGIN
 FOR v IN SELECT ord.id,ord.restaurant_id,ord.version,r.organization_id FROM orders ord
 JOIN restaurants r ON r.id=ord.restaurant_id WHERE ord.status='pending' AND ord.expires_at<=clock_timestamp()
 ORDER BY ord.expires_at LIMIT 50 FOR UPDATE OF ord SKIP LOCKED LOOP
   UPDATE orders SET status='expired',version=v.version+1,updated_at=clock_timestamp() WHERE id=v.id;
   INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type)
   VALUES(gen_random_uuid()::text,v.id,v.restaurant_id,'pending','expired','expired','Acceptance window elapsed','system');
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   VALUES(gen_random_uuid()::text,v.organization_id,v.restaurant_id,'order.status_changed',1,v.version+1,
   jsonb_build_object('orderId',v.id,'fromStatus','pending','toStatus','expired'));
   v_count:=v_count+1;
 END LOOP;
 RETURN v_count;
END $$;
REVOKE ALL ON FUNCTION app_private.expire_pending_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.expire_pending_orders() TO menuminute_worker;


-- Financial state is never a side effect of a kitchen transition.
CREATE FUNCTION app_private.record_order_payment(
 p_outlet text,p_order text,p_expected integer,p_status text,p_method text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v orders%ROWTYPE; v_org text;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'billing.manage') THEN
   RAISE EXCEPTION 'Finance permission required' USING ERRCODE='42501';
 END IF;
 IF p_status NOT IN ('paid','voided') OR p_method NOT IN ('cash','card','other') THEN
   RAISE EXCEPTION 'Invalid payment transition' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v FROM orders WHERE id=p_order AND restaurant_id=p_outlet FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE='22023'; END IF;
 IF v.version<>p_expected OR v.payment_status<>'unpaid' THEN
   RAISE EXCEPTION 'Stale payment state' USING ERRCODE='40001';
 END IF;
 IF p_status='paid' AND v.status NOT IN ('ready','served','collected') THEN
   RAISE EXCEPTION 'Order is not ready for settlement' USING ERRCODE='22023';
 END IF;
 IF p_status='voided' AND v.status NOT IN ('rejected','cancelled','expired') THEN
   RAISE EXCEPTION 'Only cancelled orders may void an unpaid balance' USING ERRCODE='22023';
 END IF;
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;
 UPDATE orders SET payment_status=p_status,version=v.version+1,updated_at=clock_timestamp()
 WHERE id=v.id AND version=p_expected AND restaurant_id=p_outlet AND payment_status='unpaid';
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale payment state' USING ERRCODE='40001'; END IF;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,v_org,current_setting('app.actor_id',true),'order.payment',
 jsonb_build_object('orderId',v.id,'outletId',p_outlet,'from','unpaid','to',p_status,
 'method',p_method,'totalMinor',v.total_minor,'currency',v.currency,'version',v.version+1));
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,v_org,p_outlet,'order.payment_changed',1,v.version+1,
 jsonb_build_object('orderId',v.id,'paymentStatus',p_status));
 RETURN jsonb_build_object('success',true,'orderId',v.id,'paymentStatus',p_status,'version',v.version+1);
END $$;
REVOKE ALL ON FUNCTION app_private.record_order_payment(text,text,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.record_order_payment(text,text,integer,text,text) TO menuminute_app;

-- Idempotency recovery happens before menu repricing; a lost successful response remains recoverable.
CREATE FUNCTION app_private.lookup_guest_submission(p_token text,p_key text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v orders%ROWTYPE;
BEGIN
 SELECT ord.* INTO v FROM orders ord JOIN qr_codes q ON q.restaurant_id=ord.restaurant_id
 JOIN restaurants r ON r.id=q.restaurant_id JOIN organizations org ON org.id=r.organization_id
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND org.is_active
 AND ord.client_submission_key=p_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF v.request_hash IS DISTINCT FROM p_hash THEN
   RAISE EXCEPTION 'Submission key reused with different cart' USING ERRCODE='22023';
 END IF;
 RETURN jsonb_build_object('orderId',v.id,'trackingToken',v.tracking_token,
 'orderNumber',v.order_number,'status',v.status,'totalMinor',v.total_minor,
 'currency',v.currency,'isDuplicate',true);
END $$;
REVOKE ALL ON FUNCTION app_private.lookup_guest_submission(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.lookup_guest_submission(text,text,text) TO menuminute_app;
