-- Phase 5 E–H: additive operational kitchen contracts; activation remains fail-closed.
-- 0013 is immutable. All mutations acquire canonical orders lock before kitchen_work.
CREATE TABLE kitchen_command_receipts (
 outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,
 action text NOT NULL CHECK (action IN ('work.start','work.complete','expo.release','work.reassign')),
 target_id text NOT NULL,
 expected_version integer NOT NULL CHECK (expected_version>=0),
 argument text NOT NULL DEFAULT '',
 result jsonb NOT NULL,
 actor_id text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(outlet_id,request_key)
);
CREATE INDEX kitchen_receipts_age ON kitchen_command_receipts(created_at);
CREATE TABLE kitchen_work_history (
 id text PRIMARY KEY,
 outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
 work_id text NOT NULL REFERENCES kitchen_work(id) ON DELETE RESTRICT,
 order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 old_station_id text NOT NULL,
 new_station_id text NOT NULL,
 previous_state text NOT NULL,
 expected_version integer NOT NULL,
 actor_id text NOT NULL,
 reason text NOT NULL CHECK (length(reason) BETWEEN 5 AND 500),
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX kitchen_history_work ON kitchen_work_history(outlet_id,work_id,occurred_at);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['kitchen_command_receipts','kitchen_work_history'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,menuminute_app,menuminute_worker',t);
 END LOOP;
END $$;

-- Captures retries and double-clicks atomically; a reused key with different payload fails.
CREATE FUNCTION app_private.kitchen_work_command_v2(
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
REVOKE ALL ON FUNCTION app_private.kitchen_work_command_v2(text,text,text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_work_command_v2(text,text,text,integer,uuid) TO menuminute_app;
REVOKE EXECUTE ON FUNCTION app_private.kitchen_work_command(text,text,text,integer) FROM menuminute_app;

-- Expeditor is the only way a kitchen-managed order becomes guest-facing Ready.
-- Requires an explicit preparing step, all station work complete and the canonical order version.
CREATE FUNCTION app_private.kitchen_expo_release(p_outlet text,p_order text,p_expected integer,p_key uuid)
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
 IF o.status<>'preparing' OR o.version<>p_expected
 OR NOT COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=p_outlet),false)
 OR NOT EXISTS (SELECT 1 FROM kitchen_work WHERE order_id=o.id AND outlet_id=p_outlet)
 OR EXISTS (SELECT 1 FROM kitchen_work WHERE order_id=o.id AND outlet_id=p_outlet AND status<>'complete')
 THEN RAISE EXCEPTION 'All station work must be complete; reconcile order status' USING ERRCODE='40001'; END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 UPDATE orders SET status='ready',version=version+1,updated_at=clock_timestamp()
 WHERE id=o.id AND restaurant_id=p_outlet AND status='preparing' AND version=p_expected;
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
REVOKE ALL ON FUNCTION app_private.kitchen_expo_release(text,text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_expo_release(text,text,integer,uuid) TO menuminute_app;

-- Retains the same work identity, snapshots original station and state into append-only history.
-- Only outlet managers may move an in-progress ticket; completed/cancelled work cannot move.
CREATE FUNCTION app_private.kitchen_reassign(
 p_outlet text,p_work text,p_station text,p_expected integer,p_key uuid,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE w kitchen_work%ROWTYPE; o orders%ROWTYPE; prior kitchen_command_receipts%ROWTYPE;
 org text; actor text:=current_setting('app.actor_id',true); result jsonb; n bigint;
BEGIN
 IF p_key IS NULL OR p_expected<0 OR length(trim(p_reason)) NOT BETWEEN 5 AND 500
 OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'outlet.manage') OR NOT app_private.kitchen_access(p_outlet)
 THEN RAISE EXCEPTION 'Forbidden or invalid reassignment' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet;
 IF NOT FOUND THEN RAISE EXCEPTION 'Work unavailable' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM orders WHERE id=w.order_id AND restaurant_id=p_outlet FOR UPDATE;
 SELECT * INTO prior FROM kitchen_command_receipts WHERE outlet_id=p_outlet AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF prior.action<>'work.reassign' OR prior.target_id<>p_work OR prior.expected_version<>p_expected
  OR prior.argument<>p_station||':'||trim(p_reason) OR prior.actor_id IS DISTINCT FROM actor
  THEN RAISE EXCEPTION 'Request key reuse' USING ERRCODE='40001'; END IF;
  RETURN prior.result;
 END IF;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet FOR UPDATE;
 IF o.id IS NULL OR o.status NOT IN ('accepted','preparing') OR w.version<>p_expected
 OR w.status NOT IN ('queued','preparing') OR w.station_id=p_station
 OR NOT COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=p_outlet),false)
 OR NOT EXISTS(SELECT 1 FROM kitchen_stations WHERE id=p_station AND outlet_id=p_outlet AND active)
 OR EXISTS(SELECT 1 FROM kitchen_work WHERE order_item_id=w.order_item_id AND station_id=p_station AND id<>w.id)
 THEN RAISE EXCEPTION 'Invalid or stale reassignment' USING ERRCODE='40001'; END IF;
 INSERT INTO kitchen_work_history(id,outlet_id,work_id,order_id,old_station_id,new_station_id,
 previous_state,expected_version,actor_id,reason)
 VALUES(gen_random_uuid()::text,p_outlet,w.id,o.id,w.station_id,p_station,w.status,p_expected,actor,trim(p_reason));
 UPDATE kitchen_work SET station_id=p_station,rule_version=rule_version+1,version=version+1,
 updated_at=clock_timestamp() WHERE id=w.id;
 n:=app_private.kitchen_emit(p_outlet,'work.changed',w.id);
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 result:=jsonb_build_object('workId',w.id,'stationId',p_station,'version',w.version+1,'seq',n);
 INSERT INTO kitchen_command_receipts(outlet_id,request_key,action,target_id,expected_version,argument,result,actor_id)
 VALUES(p_outlet,p_key,'work.reassign',p_work,p_expected,p_station||':'||trim(p_reason),result,actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,actor,'kitchen.work.reassign',
 jsonb_build_object('workId',w.id,'oldStation',w.station_id,'newStation',p_station,
 'reason',trim(p_reason),'key',p_key,'seq',n));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_reassign(text,text,text,integer,uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_reassign(text,text,text,integer,uuid,text) TO menuminute_app;

-- Small, scoped expeditor projection. Never emits customer contact details.
CREATE FUNCTION app_private.kitchen_expo_snapshot(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.kitchen_access(p_outlet) OR NOT app_private.can_outlet(p_outlet,'orders.complete')
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'cursor',COALESCE((SELECT last_seq FROM kitchen_event_counters WHERE outlet_id=p_outlet),0),
  'overflow',(SELECT COUNT(*)>60 FROM orders o WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing')
    AND EXISTS(SELECT 1 FROM kitchen_work w WHERE w.order_id=o.id)),
  'orders',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',q.id,'orderNumber',q.order_number,'status',q.status,'version',q.version,
    'fulfillmentMode',q.fulfillment_mode,'tableLabel',q.table_label,
    'total',q.total,'done',q.done,'started',q.started,'createdAt',q.created_at)
    ORDER BY q.created_at,q.id)
   FROM (SELECT o.id,o.order_number,o.status,o.version,o.fulfillment_mode,
     t.table_number AS table_label,o.created_at,COUNT(w.id)::integer AS total,
     COUNT(w.id) FILTER (WHERE w.status='complete')::integer AS done,
     COUNT(w.id) FILTER (WHERE w.status='preparing')::integer AS started
     FROM orders o JOIN kitchen_work w ON w.order_id=o.id AND w.outlet_id=p_outlet
     LEFT JOIN restaurant_tables t ON t.id=o.table_id
     WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing')
     GROUP BY o.id,t.table_number ORDER BY o.created_at,o.id LIMIT 60) q),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_expo_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_expo_snapshot(text) TO menuminute_app;

-- Existing merchant board can label kitchen-managed orders without direct grants on private tables.
CREATE FUNCTION app_private.kitchen_managed_orders(p_outlet text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT CASE WHEN current_setting('app.outlet_id',true)=p_outlet
 AND app_private.can_outlet(p_outlet,'orders.read')
 THEN COALESCE((SELECT jsonb_agg(q.id) FROM
 (SELECT o.id FROM orders o
 WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing','ready')
 AND EXISTS(SELECT 1 FROM kitchen_work w WHERE w.order_id=o.id AND w.outlet_id=p_outlet)
 ORDER BY o.created_at DESC,o.id LIMIT 100) q),'[]'::jsonb)
 ELSE '[]'::jsonb END
$$;
REVOKE ALL ON FUNCTION app_private.kitchen_managed_orders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_managed_orders(text) TO menuminute_app;

-- Operational maintenance only; migration-owner runs after verified backups.
-- Keep at least 1,000 events per outlet and 14 days; stale cursors get resync=true.
CREATE FUNCTION app_private.kitchen_prune_events()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n integer;
BEGIN
 DELETE FROM kitchen_events e USING kitchen_event_counters c
 WHERE e.outlet_id=c.outlet_id AND e.seq<c.last_seq-1000
 AND e.occurred_at<clock_timestamp()-interval '14 days';
 GET DIAGNOSTICS n=ROW_COUNT;
 DELETE FROM kitchen_command_receipts WHERE created_at<clock_timestamp()-interval '30 days';
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_prune_events() FROM PUBLIC;

-- A bounded active snapshot never silently truncates: workOverflow is surfaced to operators.
CREATE OR REPLACE FUNCTION app_private.kitchen_snapshot(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb; is_admin boolean; member text;
BEGIN
 IF NOT app_private.kitchen_access(p_outlet) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT m.id,(m.role IN ('owner','admin') OR app_private.can_outlet(p_outlet,'outlet.manage')) INTO member,is_admin
 FROM organization_members m JOIN restaurants r ON r.organization_id=m.organization_id
 WHERE r.id=p_outlet AND m.user_id=current_setting('app.actor_id',true) AND m.is_active;
 SELECT jsonb_build_object(
 'cursor',COALESCE((SELECT last_seq FROM kitchen_event_counters WHERE outlet_id=p_outlet),0),
 'enabled',COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=p_outlet),false),
 'stations',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active,
   'position',s.position) ORDER BY s.position,s.name) FROM kitchen_stations s
   WHERE s.outlet_id=p_outlet AND s.active AND (is_admin OR EXISTS(
    SELECT 1 FROM kitchen_station_members sm WHERE sm.station_id=s.id AND sm.member_id=member))), '[]'::jsonb),
 'routes',CASE WHEN is_admin THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('dishId',dish_id,'stationId',station_id,'ruleVersion',rule_version) ORDER BY dish_id,station_id)
 FROM kitchen_routes WHERE outlet_id=p_outlet),'[]'::jsonb) ELSE '[]'::jsonb END,
 'members',CASE WHEN is_admin THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',m.id,'name',u.name,'stationIds',COALESCE((SELECT jsonb_agg(sm.station_id ORDER BY sm.station_id)
     FROM kitchen_station_members sm WHERE sm.member_id=m.id AND sm.outlet_id=p_outlet),'[]'::jsonb))
   ORDER BY u.name,m.id)
   FROM organization_members m JOIN users u ON u.id=m.user_id
   JOIN restaurants r ON r.organization_id=m.organization_id
   JOIN outlet_grants g ON g.organization_id=m.organization_id AND g.member_id=m.id AND g.outlet_id=p_outlet
   WHERE r.id=p_outlet AND m.is_active AND g.roles && ARRAY['manager','kitchen']::text[]),'[]'::jsonb)
   ELSE '[]'::jsonb END,
 'workOverflow',(SELECT COUNT(*)>500 FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=p_outlet
 WHERE w.outlet_id=p_outlet AND w.status IN ('queued','preparing','complete') AND o.status IN ('accepted','preparing')
 AND (is_admin OR EXISTS(SELECT 1 FROM kitchen_station_members sm WHERE sm.station_id=w.station_id AND sm.member_id=member))),
 'work',COALESCE((SELECT jsonb_agg(x.payload ORDER BY x.created_at,x.id) FROM (SELECT jsonb_build_object(
   'id',w.id,'stationId',w.station_id,'orderId',w.order_id,'orderNumber',o.order_number,
   'fulfillmentMode',o.fulfillment_mode,'tableLabel',t.table_number,'brandLabel',r.name,
   'dishName',i.item_name,'quantity',i.quantity,'variantName',i.variant_name,
   'selectedOptions',i.selected_options,'notes',i.notes,'orderNotes',o.notes,
   'status',w.status,'version',w.version,'createdAt',w.created_at,'updatedAt',w.updated_at) AS payload,w.created_at,w.id
  FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=p_outlet
  JOIN order_items i ON i.id=w.order_item_id JOIN restaurants r ON r.id=p_outlet
  LEFT JOIN restaurant_tables t ON t.id=o.table_id
  WHERE w.outlet_id=p_outlet AND w.status IN ('queued','preparing','complete')
   AND o.status IN ('accepted','preparing')
   AND (is_admin OR EXISTS(SELECT 1 FROM kitchen_station_members sm
     WHERE sm.station_id=w.station_id AND sm.member_id=member))
  ORDER BY w.created_at,w.id LIMIT 500) x),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;

-- Feature flag and entitlement are separate requirements: new accepted kitchen orders need both.
-- Existing accepted tickets may still be finished after a grant expires; never strand prepared food.
CREATE FUNCTION app_private.kitchen_accept_entitlement_check() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org text;
BEGIN
 IF COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=NEW.restaurant_id),false) THEN
  SELECT organization_id INTO org FROM restaurants WHERE id=NEW.restaurant_id;
  IF NOT EXISTS(SELECT 1 FROM entitlement_grants e
    WHERE e.organization_id=org AND e.capability='kitchen.new' AND e.revoked_at IS NULL
      AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()) THEN
   RAISE EXCEPTION 'Active Kitchen Pro entitlement required for new acceptance' USING ERRCODE='42501';
  END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_accept_entitlement_check() FROM PUBLIC;
CREATE TRIGGER kitchen_accept_entitlement BEFORE UPDATE OF status ON orders
 FOR EACH ROW WHEN (NEW.status='accepted' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION app_private.kitchen_accept_entitlement_check();
