ALTER TABLE users ADD COLUMN terms_version text;
ALTER TABLE users ADD COLUMN terms_accepted_at timestamp with time zone;
ALTER TABLE users ADD CONSTRAINT users_terms_version_check CHECK (terms_version IS NULL OR terms_version = '2026-10-24');

-- Checkout reliability, scheduled pickup and outlet scheduling controls.
ALTER TABLE restaurants ADD COLUMN pickup_lead_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE restaurants ADD COLUMN pickup_slot_minutes integer NOT NULL DEFAULT 15;
ALTER TABLE restaurants ADD COLUMN pickup_advance_days integer NOT NULL DEFAULT 7;
ALTER TABLE restaurants ADD CONSTRAINT restaurants_pickup_schedule_check CHECK (
 pickup_lead_minutes BETWEEN 0 AND 240 AND pickup_slot_minutes BETWEEN 5 AND 120 AND pickup_advance_days BETWEEN 1 AND 30
);
ALTER TABLE orders ADD COLUMN requested_fulfillment_at timestamp with time zone;
CREATE INDEX orders_pickup_due_idx ON orders(restaurant_id,requested_fulfillment_at)
 WHERE fulfillment_mode='pickup' AND status IN ('pending','accepted','preparing','ready');

CREATE FUNCTION app_private.public_pickup_settings(p_token text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object(
   'leadMinutes',r.pickup_lead_minutes,
   'slotMinutes',r.pickup_slot_minutes,
   'advanceDays',r.pickup_advance_days
 )
 FROM qr_codes q
 JOIN restaurants r ON r.id=q.restaurant_id
 JOIN organizations o ON o.id=r.organization_id
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND r.is_published AND o.is_active
 LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.public_pickup_settings(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.public_pickup_settings(text) TO menuminute_app;

CREATE OR REPLACE FUNCTION app_private.update_outlet_profile(p_org text,p_outlet text,p_expected integer,p_data jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); r restaurants%ROWTYPE; field text;
  email_value text; website_value text;
BEGIN
 IF actor IS NULL OR p_expected<0 OR jsonb_typeof(p_data)<>'object' THEN
  RAISE EXCEPTION 'Invalid profile command' USING ERRCODE='22023'; END IF;
 FOR field IN SELECT jsonb_object_keys(p_data) LOOP
  IF field NOT IN ('description','phone','email','website','addressLine1','addressLine2','city','state','postalCode','primaryColor','secondaryColor','pickupLeadMinutes','pickupSlotMinutes','pickupAdvanceDays')
     OR (field IN ('pickupLeadMinutes','pickupSlotMinutes','pickupAdvanceDays') AND jsonb_typeof(p_data->field)<>'number')
     OR (field NOT IN ('pickupLeadMinutes','pickupSlotMinutes','pickupAdvanceDays') AND jsonb_typeof(p_data->field) NOT IN ('string','null')) THEN
   RAISE EXCEPTION 'Unsupported profile field' USING ERRCODE='22023'; END IF;
 END LOOP;
 IF (SELECT count(*) FROM jsonb_object_keys(p_data))<>14 THEN
   RAISE EXCEPTION 'Complete profile payload required' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM organizations WHERE id=p_org AND is_active FOR SHARE;
 IF NOT FOUND OR NOT app_private.can_outlet(p_outlet,'outlet.manage') THEN
  RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 IF r.profile_version<>p_expected THEN RAISE EXCEPTION 'Profile changed on another device' USING ERRCODE='40001'; END IF;
 IF length(coalesce(p_data->>'description',''))>500 OR length(coalesce(p_data->>'phone',''))>40
 OR length(coalesce(p_data->>'email',''))>254 OR length(coalesce(p_data->>'website',''))>512
 OR length(coalesce(p_data->>'addressLine1',''))>180 OR length(coalesce(p_data->>'addressLine2',''))>180
 OR length(coalesce(p_data->>'city',''))>100 OR length(coalesce(p_data->>'state',''))>100
 OR length(coalesce(p_data->>'postalCode',''))>24 THEN
 RAISE EXCEPTION 'Profile field exceeds limit' USING ERRCODE='22023'; END IF;
 email_value:=NULLIF(trim(p_data->>'email'),''); website_value:=NULLIF(trim(p_data->>'website'),'');
 IF email_value IS NOT NULL AND email_value !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
 RAISE EXCEPTION 'Invalid email' USING ERRCODE='22023'; END IF;
 IF website_value IS NOT NULL AND website_value !~* '^https?://[^[:space:]]+\.[^[:space:]]+$' THEN
 RAISE EXCEPTION 'Invalid website' USING ERRCODE='22023'; END IF;
 IF (p_data->>'pickupLeadMinutes')::integer NOT BETWEEN 0 AND 240
 OR (p_data->>'pickupSlotMinutes')::integer NOT BETWEEN 5 AND 120
 OR (p_data->>'pickupAdvanceDays')::integer NOT BETWEEN 1 AND 30 THEN
 RAISE EXCEPTION 'Invalid pickup scheduling limits' USING ERRCODE='22023'; END IF;
 IF (p_data->>'primaryColor') IS NULL OR (p_data->>'secondaryColor') IS NULL
 OR (p_data->>'primaryColor') !~ '^#[0-9a-fA-F]{6}$'
 OR (p_data->>'secondaryColor') !~ '^#[0-9a-fA-F]{6}$' THEN
 RAISE EXCEPTION 'Invalid branding color' USING ERRCODE='22023'; END IF;
 UPDATE restaurants SET description=NULLIF(trim(p_data->>'description'),''),
 phone=NULLIF(trim(p_data->>'phone'),''), email=lower(email_value), website=website_value,
 address_line1=NULLIF(trim(p_data->>'addressLine1'),''),address_line2=NULLIF(trim(p_data->>'addressLine2'),''),
 city=NULLIF(trim(p_data->>'city'),''),state=NULLIF(trim(p_data->>'state'),''),
 postal_code=NULLIF(trim(p_data->>'postalCode'),''),primary_color=p_data->>'primaryColor',
 secondary_color=p_data->>'secondaryColor',
 pickup_lead_minutes=(p_data->>'pickupLeadMinutes')::integer,pickup_slot_minutes=(p_data->>'pickupSlotMinutes')::integer,
 pickup_advance_days=(p_data->>'pickupAdvanceDays')::integer,profile_version=profile_version+1,updated_at=now()
 WHERE id=p_outlet;
 INSERT INTO audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id)
 VALUES(gen_random_uuid()::text,actor,p_outlet,'settings.profile.update','outlet',p_outlet);
 RETURN p_expected+1;
END $$;
REVOKE ALL ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.update_outlet_profile(text,text,integer,jsonb) TO menuminute_app;

CREATE OR REPLACE FUNCTION app_private.submit_guest_order(p_token text,p_payload jsonb)
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
   'currency',prior.currency,'requestedFulfillmentAt',prior.requested_fulfillment_at,'isDuplicate',true);
 END IF;
 IF NOT EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.organization_id=o.id AND g.capability='ordering.new'
 AND g.revoked_at IS NULL AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp()) THEN
   RAISE EXCEPTION 'Online ordering is not enabled for this outlet' USING ERRCODE='42501';
 END IF;
 IF NOT (p_payload->>'fulfillmentMode'=ANY(r.fulfillment_modes)) THEN
   RAISE EXCEPTION 'Unsupported fulfillment mode' USING ERRCODE='22023';
 END IF;
 IF p_payload->>'fulfillmentMode'='pickup' AND (
   p_payload->>'requestedFulfillmentAt' IS NULL OR
   (p_payload->>'requestedFulfillmentAt')::timestamptz < clock_timestamp() + make_interval(mins=>r.pickup_lead_minutes) OR
   (p_payload->>'requestedFulfillmentAt')::timestamptz > clock_timestamp() + make_interval(days=>r.pickup_advance_days) OR
   (extract(hour FROM (p_payload->>'requestedFulfillmentAt')::timestamptz AT TIME ZONE r.timezone)::integer*60 +
    extract(minute FROM (p_payload->>'requestedFulfillmentAt')::timestamptz AT TIME ZONE r.timezone)::integer) % r.pickup_slot_minutes <> 0
 ) THEN RAISE EXCEPTION 'Invalid pickup time' USING ERRCODE='22023'; END IF;
 IF p_payload->>'fulfillmentMode'<>'pickup' AND p_payload->>'requestedFulfillmentAt' IS NOT NULL THEN
   RAISE EXCEPTION 'Only pickup orders can be scheduled' USING ERRCODE='22023';
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
   IF v_qty NOT BETWEEN 1 AND 999 OR v_unit<0 OR v_item_total<>(v_qty::bigint*v_unit) THEN
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
 INSERT INTO orders(id,restaurant_id,table_id,customer_name,customer_phone,fulfillment_mode,requested_fulfillment_at,
 status,payment_status,currency,subtotal_minor,tax_minor,total_minor,subtotal_paise,tax_paise,total_paise,
 notes,client_submission_key,request_hash,tracking_token,expires_at,business_date,order_number,version)
 VALUES(v_id,r.id,CASE WHEN p_payload->>'fulfillmentMode'='dine_in' THEN q.table_id ELSE NULL END,
 NULLIF(p_payload->>'customerName',''),NULLIF(p_payload->>'customerPhone',''),p_payload->>'fulfillmentMode',
 CASE WHEN p_payload->>'fulfillmentMode'='pickup' THEN (p_payload->>'requestedFulfillmentAt')::timestamptz ELSE NULL END,
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
 'status','pending','totalMinor',v_sum,'currency',r.currency,'requestedFulfillmentAt',CASE WHEN p_payload->>'fulfillmentMode'='pickup' THEN p_payload->>'requestedFulfillmentAt' ELSE NULL END,'isDuplicate',false);
END $$;
REVOKE ALL ON FUNCTION app_private.submit_guest_order(text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.submit_guest_order(text,jsonb) TO menuminute_app;

CREATE OR REPLACE FUNCTION app_private.track_guest_order(p_token text,p_order text,p_tracking text)
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
   'status',v_order.status,'requestedFulfillmentAt',v_order.requested_fulfillment_at,'paymentStatus',v_order.payment_status,'fulfillmentMode',v_order.fulfillment_mode,
   'currency',v_order.currency,'subtotalMinor',v_order.subtotal_minor,'taxMinor',v_order.tax_minor,
   'totalMinor',v_order.total_minor,'notes',v_order.notes,'rejectionReason',v_order.rejection_reason,
   'createdAt',v_order.created_at,'updatedAt',v_order.updated_at,'point',v_point),
   'outlet',jsonb_build_object('name',v_outlet.name,'currency',v_outlet.currency),
   'items',v_items,'events',v_events);
END $$;
REVOKE ALL ON FUNCTION app_private.track_guest_order(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.track_guest_order(text,text,text) TO menuminute_app;
