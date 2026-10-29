-- Phase A: canonical order state follows authorized station start.
-- Also permits one-at-a-time recovery of accepted orders whose station work
-- was already complete when the old flow prevented expeditor release.
-- All changes preserve command receipts, actor, outlet scope, lock order and
-- version checks; no prior migration or live ticket is rewritten.
CREATE OR REPLACE FUNCTION app_private.kitchen_work_command_v2(
 p_outlet text,p_work text,p_action text,p_expected integer,p_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE w kitchen_work%ROWTYPE; o orders%ROWTYPE; prior kitchen_command_receipts%ROWTYPE;
 next_state text; result jsonb; n bigint; org text; actor text:=current_setting('app.actor_id',true);
BEGIN
 IF p_key IS NULL OR p_expected<0 OR p_action NOT IN ('start','complete') THEN
  RAISE EXCEPTION 'Invalid kitchen command' USING ERRCODE='22023'; END IF;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet;
 IF NOT FOUND OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'orders.prepare') OR NOT app_private.kitchen_access(p_outlet,w.station_id)
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM orders WHERE id=w.order_id AND restaurant_id=p_outlet FOR UPDATE;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet FOR UPDATE;
 -- Station assignment may change while waiting on the order lock. Always re-authorize
 -- the current locked row, including idempotent replays, before returning any result.
 IF w.id IS NULL OR NOT app_private.kitchen_access(p_outlet,w.station_id)
 THEN RAISE EXCEPTION 'Current station permission required' USING ERRCODE='42501'; END IF;
 SELECT * INTO prior FROM kitchen_command_receipts WHERE outlet_id=p_outlet AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF prior.action<>'work.'||p_action OR prior.target_id<>p_work OR prior.expected_version<>p_expected
   OR prior.actor_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Request key reuse' USING ERRCODE='40001'; END IF;
  -- Recheck current permission even for a cached response; never return a success to revoked actors.
  IF NOT app_private.kitchen_access(p_outlet,w.station_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  RETURN prior.result;
 END IF;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet FOR UPDATE;
 IF o.id IS NULL OR o.status NOT IN ('accepted','preparing') OR w.version<>p_expected
 OR NOT COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=p_outlet),false)
 THEN RAISE EXCEPTION 'Stale kitchen state' USING ERRCODE='40001'; END IF;
 next_state:=CASE WHEN p_action='start' AND w.status='queued' THEN 'preparing'
 WHEN p_action='complete' AND w.status='preparing' THEN 'complete' ELSE NULL END;
 IF next_state IS NULL THEN RAISE EXCEPTION 'Invalid kitchen transition' USING ERRCODE='22023'; END IF;
 UPDATE kitchen_work SET status=next_state,version=version+1,updated_at=clock_timestamp() WHERE id=w.id;
 -- First real preparation action advances the canonical merchant order in the
 -- SAME locked transaction as the station task. Guests never see Ready here.
 IF p_action='start' AND o.status='accepted' THEN
   UPDATE orders SET status='preparing',version=version+1,updated_at=clock_timestamp()
     WHERE id=o.id AND restaurant_id=p_outlet AND status='accepted' AND version=o.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Stale order while starting preparation' USING ERRCODE='40001'; END IF;
   SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
   INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
   VALUES(gen_random_uuid()::text,o.id,p_outlet,'accepted','preparing','preparing',
     'First authorized Kitchen Pro station started preparation','staff',actor);
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   VALUES(gen_random_uuid()::text,org,p_outlet,'order.status_changed',1,o.version+1,
     jsonb_build_object('orderId',o.id,'fromStatus','accepted','toStatus','preparing'));
 END IF;
 n:=app_private.kitchen_emit(p_outlet,'work.changed',w.id);
 result:=jsonb_build_object('workId',w.id,'status',next_state,'version',w.version+1,'seq',n);
 INSERT INTO kitchen_command_receipts(outlet_id,request_key,action,target_id,expected_version,result,actor_id)
 VALUES(p_outlet,p_key,'work.'||p_action,p_work,p_expected,result,actor);
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,actor,'kitchen.work.'||p_action,
 jsonb_build_object('workId',w.id,'orderId',w.order_id,'version',p_expected,'key',p_key,'seq',n));
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION app_private.kitchen_expo_release(p_outlet text,p_order text,p_expected integer,p_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o orders%ROWTYPE; prior kitchen_command_receipts%ROWTYPE;
 actor text:=current_setting('app.actor_id',true); org text; result jsonb; n bigint;
BEGIN
 IF p_key IS NULL OR p_expected<0 OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.kitchen_access(p_outlet) OR NOT app_private.can_outlet(p_outlet,'orders.complete')
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM orders WHERE id=p_order AND restaurant_id=p_outlet FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO prior FROM kitchen_command_receipts WHERE outlet_id=p_outlet AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF prior.action<>'expo.release' OR prior.target_id<>p_order OR prior.expected_version<>p_expected
   OR prior.actor_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Request key reuse' USING ERRCODE='40001'; END IF;
  RETURN prior.result;
 END IF;
 IF o.status NOT IN ('accepted','preparing') OR o.version<>p_expected
 OR NOT COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=p_outlet),false)
 OR NOT EXISTS (SELECT 1 FROM kitchen_work WHERE order_id=o.id AND outlet_id=p_outlet)
 OR EXISTS (SELECT 1 FROM kitchen_work WHERE order_id=o.id AND outlet_id=p_outlet AND status<>'complete')
 THEN RAISE EXCEPTION 'All station work must be complete; reconcile order status' USING ERRCODE='40001'; END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 -- Recover previously completed Kitchen work left in accepted due to the
 -- legacy station-start bug. No mass changes and no bypass of all-work-complete.
 IF o.status='accepted' THEN
   UPDATE orders SET status='preparing',version=version+1,updated_at=clock_timestamp()
     WHERE id=o.id AND restaurant_id=p_outlet AND status='accepted' AND version=p_expected;
   IF NOT FOUND THEN RAISE EXCEPTION 'Stale recovery attempt' USING ERRCODE='40001'; END IF;
   INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
   VALUES(gen_random_uuid()::text,o.id,p_outlet,'accepted','preparing','preparing',
     'Kitchen Pro reconciled completed station work before expeditor release','staff',actor);
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   VALUES(gen_random_uuid()::text,org,p_outlet,'order.status_changed',1,o.version+1,
     jsonb_build_object('orderId',o.id,'fromStatus','accepted','toStatus','preparing'));
   o.version:=o.version+1;
   o.status:='preparing';
 END IF;
 UPDATE orders SET status='ready',version=version+1,updated_at=clock_timestamp()
 WHERE id=o.id AND restaurant_id=p_outlet AND status='preparing' AND version=o.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale order version' USING ERRCODE='40001'; END IF;
 INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
 VALUES(gen_random_uuid()::text,o.id,p_outlet,'preparing','ready','ready',
  'All kitchen stations complete; expeditor released','staff',actor);
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,org,p_outlet,'order.status_changed',1,o.version+1,
 jsonb_build_object('orderId',o.id,'fromStatus','preparing','toStatus','ready'));
 n:=app_private.kitchen_emit(p_outlet,'work.changed');
 result:=jsonb_build_object('orderId',o.id,'currentStatus','ready','version',o.version+1,'seq',n);
 INSERT INTO kitchen_command_receipts(outlet_id,request_key,action,target_id,expected_version,result,actor_id)
 VALUES(p_outlet,p_key,'expo.release',p_order,p_expected,result,actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,actor,'kitchen.expo.release',
  jsonb_build_object('orderId',o.id,'version',p_expected,'key',p_key,'seq',n));
 RETURN result;
END $$;
