-- Hospitality operations. Forward-only, after 0029.
CREATE INDEX IF NOT EXISTS orders_outlet_table_activity
 ON orders(restaurant_id,table_id,created_at DESC)
 WHERE table_id IS NOT NULL; Retain every existing onboarding
-- and Kitchen Pro function; mutations remain SECURITY DEFINER and narrowly scoped.
CREATE TABLE guest_service_requests (
 id text PRIMARY KEY,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
 order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 table_id text NOT NULL REFERENCES restaurant_tables(id) ON DELETE RESTRICT,
 signal text NOT NULL CHECK (signal IN ('call_server','water_refill','bill_request')),
 status text NOT NULL DEFAULT 'requested'
   CHECK (status IN ('requested','acknowledged','resolved')),
 requested_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 acknowledged_at timestamptz,
 acknowledged_by text REFERENCES users(id),
 resolved_at timestamptz,
 resolved_by text REFERENCES users(id),
 CHECK ((status='requested' AND acknowledged_at IS NULL AND resolved_at IS NULL)
   OR (status='acknowledged' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL)
   OR (status='resolved' AND acknowledged_at IS NOT NULL AND resolved_at IS NOT NULL))
);
CREATE INDEX guest_service_requests_outlet_queue
  ON guest_service_requests(outlet_id,status,requested_at DESC);
CREATE INDEX guest_service_requests_order_recent
  ON guest_service_requests(order_id,signal,requested_at DESC);
ALTER TABLE guest_service_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON guest_service_requests FROM PUBLIC, menuminute_app, menuminute_worker;

CREATE FUNCTION app_private.guest_service_call(
 p_token text, p_order text, p_tracking text, p_signal text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE outlet text; org text; v_order orders%ROWTYPE;
 previous guest_service_requests%ROWTYPE; request_id text;
BEGIN
 IF p_signal NOT IN ('call_server','water_refill','bill_request')
    OR p_token IS NULL OR p_tracking IS NULL OR p_order IS NULL THEN
   RAISE EXCEPTION 'Invalid service request' USING ERRCODE='22023';
 END IF;
 SELECT r.id,r.organization_id INTO outlet,org FROM qr_codes q
   JOIN restaurants r ON r.id=q.restaurant_id AND r.is_active
   JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE q.destination_token=p_token AND q.is_active LIMIT 1;
 IF outlet IS NULL THEN
   RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501';
 END IF;
 -- Lock the order before testing the cooldown. Concurrent requests serialize.
 SELECT * INTO v_order FROM orders
 WHERE id=p_order AND restaurant_id=outlet AND tracking_token=p_tracking FOR UPDATE;
 IF NOT FOUND THEN
   RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501';
 END IF;
 IF v_order.fulfillment_mode <> 'dine_in' OR v_order.table_id IS NULL
   OR v_order.status IN ('rejected','cancelled','expired','collected') THEN
   RAISE EXCEPTION 'Table service unavailable for this order' USING ERRCODE='22023';
 END IF;
 SELECT * INTO previous FROM guest_service_requests
 WHERE order_id=p_order AND signal=p_signal
   AND requested_at > clock_timestamp()-interval '30 seconds'
 ORDER BY requested_at DESC LIMIT 1;
 IF FOUND THEN
   RETURN jsonb_build_object('requestId',previous.id,'status',previous.status,
                             'debounced',true);
 END IF;
 request_id:=gen_random_uuid()::text;
 INSERT INTO guest_service_requests(id,organization_id,outlet_id,order_id,table_id,signal)
 VALUES(request_id,org,outlet,p_order,v_order.table_id,p_signal);
 -- The staff queue polls this durable record. This does not claim a delivery
 -- or acknowledgement until an authorized team member confirms it.
 RETURN jsonb_build_object('requestId',request_id,'status','requested','debounced',false);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_service_call(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_service_call(text,text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.guest_service_state(p_token text,p_order text,p_tracking text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE outlet text; result jsonb;
BEGIN
 SELECT q.restaurant_id INTO outlet FROM qr_codes q
 JOIN restaurants r ON r.id=q.restaurant_id AND r.is_active
 JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE q.destination_token=p_token AND q.is_active LIMIT 1;
 IF outlet IS NULL OR NOT EXISTS(
   SELECT 1 FROM orders
   WHERE id=p_order AND restaurant_id=outlet AND tracking_token=p_tracking
 ) THEN
   RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'requestId',z.id,'signal',z.signal,'status',z.status,
  'requestedAt',z.requested_at,'acknowledgedAt',z.acknowledged_at,
  'resolvedAt',z.resolved_at) ORDER BY z.requested_at DESC),'[]'::jsonb)
 INTO result FROM (
   SELECT * FROM guest_service_requests
   WHERE order_id=p_order AND outlet_id=outlet ORDER BY requested_at DESC LIMIT 10
 ) z;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_service_state(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_service_state(text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.staff_service_requests(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'orders.read')
 OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',q.id,'orderNumber',q.order_number,'tableNumber',q.table_number,
  'signal',q.signal,'status',q.status,'requestedAt',q.requested_at,
  'acknowledgedAt',q.acknowledged_at) ORDER BY q.requested_at DESC),'[]'::jsonb)
 INTO result FROM (
   SELECT s.id,o.order_number,t.table_number,s.signal,s.status,s.requested_at,s.acknowledged_at
   FROM guest_service_requests s
   JOIN orders o ON o.id=s.order_id AND o.restaurant_id=p_outlet
   JOIN restaurant_tables t ON t.id=s.table_id AND t.restaurant_id=p_outlet
   WHERE s.outlet_id=p_outlet AND s.organization_id=p_org
     AND s.status <> 'resolved'
   ORDER BY s.requested_at ASC LIMIT 100
 ) q;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.staff_service_requests(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.staff_service_requests(text,text) TO menuminute_app;

CREATE FUNCTION app_private.staff_service_request_action(
 p_org text,p_outlet text,p_request text,p_action text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE actor text := NULLIF(current_setting('app.actor_id',true),'');
 req guest_service_requests%ROWTYPE;
BEGIN
 IF actor IS NULL OR p_action NOT IN ('acknowledge','resolve')
 OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT (app_private.can_outlet(p_outlet,'orders.accept')
      OR app_private.can_outlet(p_outlet,'orders.complete')
      OR app_private.can_outlet(p_outlet,'outlet.manage'))
 OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO req FROM guest_service_requests
 WHERE id=p_request AND outlet_id=p_outlet AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Service request unavailable' USING ERRCODE='22023'; END IF;
 IF p_action='acknowledge' AND req.status='requested' THEN
   UPDATE guest_service_requests SET status='acknowledged',
     acknowledged_by=actor,acknowledged_at=clock_timestamp()
   WHERE id=req.id;
 ELSIF p_action='resolve' AND req.status='acknowledged' THEN
   UPDATE guest_service_requests SET status='resolved',
     resolved_by=actor,resolved_at=clock_timestamp()
   WHERE id=req.id;
 ELSIF NOT ((p_action='acknowledge' AND req.status IN ('acknowledged','resolved'))
         OR (p_action='resolve' AND req.status='resolved')) THEN
   RAISE EXCEPTION 'Acknowledge the request before resolution' USING ERRCODE='40001';
 END IF;
 INSERT INTO audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id)
 VALUES(gen_random_uuid()::text,actor,p_outlet,
   'guest_service.'||p_action,'guest_service_request',p_request);
 RETURN jsonb_build_object('id',req.id,
   'status',CASE WHEN p_action='resolve' THEN 'resolved' ELSE
       CASE WHEN req.status='resolved' THEN 'resolved' ELSE 'acknowledged' END END);
END $fn$;
REVOKE ALL ON FUNCTION app_private.staff_service_request_action(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.staff_service_request_action(text,text,text,text) TO menuminute_app;

-- A tightly scoped chef-only availability capability, preserving canonical
-- menu override history and never granting generic table write access.
CREATE FUNCTION app_private.kitchen_set_dish_availability(
 p_org text,p_outlet text,p_menu text,p_dish text,p_sold_out boolean
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE m menus%ROWTYPE; doc jsonb;
BEGIN
 IF p_sold_out IS NULL OR p_dish IS NULL OR length(p_dish)>128
 OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT (app_private.can_outlet(p_outlet,'orders.prepare')
      OR app_private.can_outlet(p_outlet,'menu.write')) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM organizations WHERE id=p_org AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO m FROM menus
 WHERE id=p_menu AND organization_id=p_org AND NOT archived
  AND published_revision IS NOT NULL
  AND EXISTS(SELECT 1 FROM menu_assignments a WHERE a.menu_id=p_menu AND a.outlet_id=p_outlet)
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Published menu unavailable' USING ERRCODE='22023'; END IF;
 SELECT document INTO doc FROM menu_releases
 WHERE menu_id=m.id AND revision=m.published_revision;
 IF NOT EXISTS(
  SELECT 1 FROM jsonb_array_elements(COALESCE(doc->'categories','[]'::jsonb)) c,
    jsonb_array_elements(COALESCE(c->'items','[]'::jsonb)) d
  WHERE d->>'id'=p_dish AND COALESCE((c->>'archived')::boolean,false)=false
    AND COALESCE((d->>'archived')::boolean,false)=false
 ) THEN RAISE EXCEPTION 'Dish is not in the published menu' USING ERRCODE='22023'; END IF;
 INSERT INTO menu_overrides(menu_id,outlet_id,dish_id,sold_out)
 VALUES(p_menu,p_outlet,p_dish,p_sold_out)
 ON CONFLICT(menu_id,outlet_id,dish_id) DO UPDATE SET sold_out=excluded.sold_out;
 UPDATE menus SET revision=revision+1,updated_at=clock_timestamp() WHERE id=p_menu;
 PERFORM app_private.record_org_change(p_org,'menu.quick_availability',p_outlet);
 RETURN jsonb_build_object('menuId',p_menu,'dishId',p_dish,'soldOut',p_sold_out);
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_set_dish_availability(text,text,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_set_dish_availability(text,text,text,text,boolean) TO menuminute_app;

CREATE FUNCTION app_private.kitchen_available_dishes(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT (app_private.can_outlet(p_outlet,'orders.prepare')
      OR app_private.can_outlet(p_outlet,'menu.read'))
 OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'menuId',z.menu_id,'id',z.dish_id,'name',z.dish_name,'category',z.category,
    'soldOut',z.sold_out) ORDER BY z.dish_name,z.menu_id),'[]'::jsonb)
 INTO result FROM (
   SELECT m.id menu_id,d->>'id' dish_id,d->>'name' dish_name,c->>'name' category,
      COALESCE(o.sold_out,(d->>'soldOut')::boolean,false) sold_out
   FROM menus m
   JOIN menu_assignments a ON a.menu_id=m.id AND a.outlet_id=p_outlet
   JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(rel.document->'categories','[]'::jsonb)) c
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(c->'items','[]'::jsonb)) d
   LEFT JOIN menu_overrides o ON o.menu_id=m.id AND o.outlet_id=p_outlet AND o.dish_id=d->>'id'
   WHERE m.organization_id=p_org AND NOT m.archived
    AND COALESCE((c->>'archived')::boolean,false)=false
    AND COALESCE((d->>'archived')::boolean,false)=false
   ORDER BY m.updated_at DESC LIMIT 250
 ) z;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_available_dishes(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_available_dishes(text,text) TO menuminute_app;
