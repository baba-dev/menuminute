-- 0077: Free order intake (docs/plans-and-limits.md, slice 2b).
-- Lets an outlet without a paid ordering grant accept guest orders up to a monthly cap, controlled by
-- an owner-only switch that defaults OFF. With the switch off every function below behaves exactly
-- as before (paid ordering.new grant required). Forward-only; to disable, set free_intake_enabled=false.
-- Only guest-menu orders count (intake_source='guest_menu'); staff/POS sales never consume the cap,
-- and rejected, cancelled and expired orders are not counted.

CREATE TABLE app_private.plan_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  free_intake_enabled boolean NOT NULL DEFAULT false,
  free_intake_monthly_cap integer NOT NULL DEFAULT 100 CHECK (free_intake_monthly_cap BETWEEN 0 AND 100000)
);
INSERT INTO app_private.plan_settings(singleton) VALUES (true);
-- Owner-controlled like deployment_edition: no application role can read or change it directly.
REVOKE ALL ON app_private.plan_settings FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.paid_ordering_active(p_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM entitlement_grants g
    WHERE g.organization_id=p_org AND g.capability='ordering.new' AND g.revoked_at IS NULL
      AND g.starts_at<=statement_timestamp() AND g.ends_at>statement_timestamp())
$$;
REVOKE ALL ON FUNCTION app_private.paid_ordering_active(text) FROM PUBLIC;

-- Guest-menu orders this calendar month in the outlet's own timezone.
CREATE FUNCTION app_private.free_intake_used(p_outlet text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT count(*)::integer FROM orders o JOIN restaurants r ON r.id=o.restaurant_id
  WHERE r.id=p_outlet AND o.intake_source='guest_menu'
    AND o.status NOT IN ('rejected','cancelled','expired')
    AND o.created_at >= (date_trunc('month', statement_timestamp() AT TIME ZONE r.timezone) AT TIME ZONE r.timezone)
$$;
REVOKE ALL ON FUNCTION app_private.free_intake_used(text) FROM PUBLIC;

-- 'off' (switch disabled), 'open' (under the cap) or 'full' (cap reached this month).
CREATE FUNCTION app_private.free_intake_state(p_outlet text) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT CASE WHEN NOT s.free_intake_enabled THEN 'off'
              WHEN app_private.free_intake_used(p_outlet) >= s.free_intake_monthly_cap THEN 'full'
              ELSE 'open' END
  FROM app_private.plan_settings s WHERE s.singleton
$$;
REVOKE ALL ON FUNCTION app_private.free_intake_state(text) FROM PUBLIC;

-- Can the public menu show checkout for this outlet right now?
CREATE FUNCTION app_private.order_intake_allowed(p_outlet text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT app_private.paid_ordering_active(r.organization_id)
      OR app_private.free_intake_state(r.id)='open'
  FROM restaurants r WHERE r.id=p_outlet
$$;
REVOKE ALL ON FUNCTION app_private.order_intake_allowed(text) FROM PUBLIC;

-- Dashboard capability: the Orders workspace stays available for members while free intake is
-- enabled, even when the month's cap is reached, so existing orders can still be managed.
CREATE FUNCTION app_private.orders_workspace_allowed(p_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT app_private.is_org_member(p_org) AND (
    app_private.paid_ordering_active(p_org)
    OR COALESCE((SELECT free_intake_enabled FROM app_private.plan_settings WHERE singleton),false))
$$;
REVOKE ALL ON FUNCTION app_private.orders_workspace_allowed(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.orders_workspace_allowed(text) TO menuminute_app;

-- The free QR catalog stays public; checkout is exposed for paid ordering or open free intake.
CREATE OR REPLACE FUNCTION app_private.public_ordering_enabled(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(
   SELECT 1 FROM qr_codes q JOIN restaurants r ON r.id=q.restaurant_id
   JOIN organizations org ON org.id=r.organization_id
   WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND r.is_published
   AND org.is_active AND app_private.order_intake_allowed(r.id)
 )
$$;

CREATE OR REPLACE FUNCTION app_private.submit_guest_order(p_token text,p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE q qr_codes%ROWTYPE; r restaurants%ROWTYPE; o organizations%ROWTYPE; prior orders%ROWTYPE;
 v_catalog jsonb; v_date date; v_number integer; v_id text; v_tracking text; v_item jsonb;
 v_sum bigint:=0; v_item_total bigint; v_qty integer; v_unit integer; v_key text:=p_payload->>'clientSubmissionKey'; v_intake text;
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
 IF NOT app_private.paid_ordering_active(o.id) THEN
   -- Free intake (0077): serialize per outlet so concurrent guests cannot overshoot the cap.
   PERFORM pg_advisory_xact_lock(hashtextextended('free-intake:'||r.id,0));
   v_intake:=app_private.free_intake_state(r.id);
   IF v_intake='full' THEN
     RAISE EXCEPTION 'Free monthly order limit reached' USING ERRCODE='42501';
   ELSIF v_intake<>'open' THEN
     RAISE EXCEPTION 'Online ordering is not enabled for this outlet' USING ERRCODE='42501';
   END IF;
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
