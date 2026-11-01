-- Per-item Final Check & Order Release.
-- Indian eateries serve dish by dish: a completed station item can be released
-- to the pass/guest without waiting for every other station. The order becomes
-- `ready` only when its last non-cancelled item is released, so the canonical
-- order state machine, receipts, outbox and lock order (orders, then
-- kitchen_work) are unchanged. All columns are nullable/additive: rolling the
-- application back leaves every existing row valid, and the previous
-- order-level release function keeps working on rows with released_at NULL.
ALTER TABLE kitchen_work ADD COLUMN IF NOT EXISTS released_at timestamptz;
ALTER TABLE kitchen_work ADD COLUMN IF NOT EXISTS released_by text;
ALTER TABLE kitchen_work DROP CONSTRAINT IF EXISTS kitchen_work_release_requires_complete;
ALTER TABLE kitchen_work ADD CONSTRAINT kitchen_work_release_requires_complete
  CHECK (released_at IS NULL OR status='complete') NOT VALID;

-- Idempotency receipts must accept the new command (existing rows stay valid).
ALTER TABLE kitchen_command_receipts DROP CONSTRAINT IF EXISTS kitchen_command_receipts_action_check;
ALTER TABLE kitchen_command_receipts ADD CONSTRAINT kitchen_command_receipts_action_check
  CHECK (action IN ('work.start','work.complete','expo.release','work.reassign','work.release'));

-- Rail snapshot: identical to 0035 plus releasedAt so released dishes are labelled.
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
   'id',m.id,'name',u.name,'role',m.role,
   'eligible',(m.role IN ('owner','admin') OR EXISTS(
     SELECT 1 FROM outlet_grants g WHERE g.organization_id=m.organization_id
       AND g.member_id=m.id AND g.outlet_id=p_outlet
       AND g.roles && ARRAY['manager','kitchen']::text[])),
   'stationIds',COALESCE((SELECT jsonb_agg(sm.station_id ORDER BY sm.station_id)
     FROM kitchen_station_members sm WHERE sm.member_id=m.id AND sm.outlet_id=p_outlet),'[]'::jsonb))
   ORDER BY u.name,m.id)
   FROM organization_members m JOIN users u ON u.id=m.user_id
   JOIN restaurants r ON r.organization_id=m.organization_id
   WHERE r.id=p_outlet AND m.is_active),'[]'::jsonb)
   ELSE '[]'::jsonb END,
 'workOverflow',(SELECT COUNT(*)>500 FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=p_outlet
 WHERE w.outlet_id=p_outlet AND w.status IN ('queued','preparing','complete') AND o.status IN ('accepted','preparing')
 AND (is_admin OR EXISTS(SELECT 1 FROM kitchen_station_members sm WHERE sm.station_id=w.station_id AND sm.member_id=member))),
 'work',COALESCE((SELECT jsonb_agg(x.payload ORDER BY x.created_at,x.id) FROM (SELECT jsonb_build_object(
   'id',w.id,'stationId',w.station_id,'orderId',w.order_id,'orderNumber',o.order_number,
   'fulfillmentMode',o.fulfillment_mode,'tableLabel',t.table_number,'brandLabel',r.name,
   'dishName',i.item_name,'quantity',i.quantity,'variantName',i.variant_name,
   'selectedOptions',i.selected_options,'notes',i.notes,'orderNotes',o.notes,
   'status',w.status,'version',w.version,'releasedAt',w.released_at,'createdAt',w.created_at,'updatedAt',w.updated_at) AS payload,w.created_at,w.id
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

-- Final Check snapshot: per-order dish list (with options and guest notes) and
-- released counts. Cancelled work no longer blocks release or inflates totals.
CREATE OR REPLACE FUNCTION app_private.kitchen_expo_snapshot(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.kitchen_access(p_outlet) OR NOT app_private.can_outlet(p_outlet,'orders.complete')
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'cursor',COALESCE((SELECT last_seq FROM kitchen_event_counters WHERE outlet_id=p_outlet),0),
  'overflow',(SELECT COUNT(*)>60 FROM orders o WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing')
    AND EXISTS(SELECT 1 FROM kitchen_work w WHERE w.order_id=o.id AND w.status<>'cancelled')),
  'orders',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',q.id,'orderNumber',q.order_number,'status',q.status,'version',q.version,
    'fulfillmentMode',q.fulfillment_mode,'tableLabel',q.table_label,'orderNotes',q.notes,
    'total',q.total,'done',q.done,'released',q.released,'started',q.started,'createdAt',q.created_at,
    'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'workId',w.id,'version',w.version,'stationId',w.station_id,'stationName',s.name,
        'dishName',i.item_name,'quantity',i.quantity,'variantName',i.variant_name,
        'selectedOptions',i.selected_options,'notes',i.notes,'status',w.status,
        'releasedAt',w.released_at) ORDER BY w.created_at,w.id)
      FROM kitchen_work w JOIN order_items i ON i.id=w.order_item_id
      JOIN kitchen_stations s ON s.outlet_id=w.outlet_id AND s.id=w.station_id
      WHERE w.order_id=q.id AND w.outlet_id=p_outlet AND w.status<>'cancelled'),'[]'::jsonb))
    ORDER BY q.created_at,q.id)
   FROM (SELECT o.id,o.order_number,o.status,o.version,o.fulfillment_mode,o.notes,
     t.table_number AS table_label,o.created_at,
     COUNT(w.id) FILTER (WHERE w.status<>'cancelled')::integer AS total,
     COUNT(w.id) FILTER (WHERE w.status='complete')::integer AS done,
     COUNT(w.id) FILTER (WHERE w.status='complete' AND w.released_at IS NOT NULL)::integer AS released,
     COUNT(w.id) FILTER (WHERE w.status='preparing')::integer AS started
     FROM orders o JOIN kitchen_work w ON w.order_id=o.id AND w.outlet_id=p_outlet
     LEFT JOIN restaurant_tables t ON t.id=o.table_id
     WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing')
     GROUP BY o.id,t.table_number
     HAVING COUNT(w.id) FILTER (WHERE w.status<>'cancelled')>0
     ORDER BY o.created_at,o.id LIMIT 60) q),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;

-- Release ONE completed dish. Managers, admins and organization owners only.
CREATE OR REPLACE FUNCTION app_private.kitchen_work_release(p_outlet text,p_work text,p_expected integer,p_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o orders%ROWTYPE; w kitchen_work%ROWTYPE; prior kitchen_command_receipts%ROWTYPE;
 actor text:=current_setting('app.actor_id',true); org text; result jsonb; n bigint;
 remaining integer; order_ready boolean:=false;
BEGIN
 IF p_key IS NULL OR p_expected<0 OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.kitchen_access(p_outlet) OR NOT app_private.can_outlet(p_outlet,'orders.complete')
 OR NOT EXISTS(SELECT 1 FROM restaurants r JOIN organization_members m ON m.organization_id=r.organization_id
   WHERE r.id=p_outlet AND m.user_id=actor AND m.is_active
   AND (m.role IN ('owner','admin') OR app_private.can_outlet(p_outlet,'outlet.manage')))
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet;
 IF NOT FOUND THEN RAISE EXCEPTION 'Work unavailable' USING ERRCODE='22023'; END IF;
 -- Lock order: orders first, then kitchen_work (same as every other command).
 SELECT * INTO o FROM orders WHERE id=w.order_id AND restaurant_id=p_outlet FOR UPDATE;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet FOR UPDATE;
 SELECT * INTO prior FROM kitchen_command_receipts WHERE outlet_id=p_outlet AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF prior.action<>'work.release' OR prior.target_id<>p_work OR prior.expected_version<>p_expected
   OR prior.actor_id IS DISTINCT FROM actor THEN RAISE EXCEPTION 'Request key reuse' USING ERRCODE='40001'; END IF;
  RETURN prior.result;
 END IF;
 IF o.id IS NULL OR o.status NOT IN ('accepted','preparing') OR w.version<>p_expected
 OR w.status<>'complete' OR w.released_at IS NOT NULL
 OR NOT COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=p_outlet),false)
 THEN RAISE EXCEPTION 'Item is not ready for release; reconcile kitchen state' USING ERRCODE='40001'; END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 IF o.status='accepted' THEN
   UPDATE orders SET status='preparing',version=version+1,updated_at=clock_timestamp()
     WHERE id=o.id AND restaurant_id=p_outlet AND status='accepted' AND version=o.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Stale order while releasing' USING ERRCODE='40001'; END IF;
   INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
   VALUES(gen_random_uuid()::text,o.id,p_outlet,'accepted','preparing','preparing',
     'Kitchen Pro reconciled completed station work before item release','staff',actor);
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   VALUES(gen_random_uuid()::text,org,p_outlet,'order.status_changed',1,o.version+1,
     jsonb_build_object('orderId',o.id,'fromStatus','accepted','toStatus','preparing'));
   o.version:=o.version+1; o.status:='preparing';
 END IF;
 UPDATE kitchen_work SET released_at=clock_timestamp(),released_by=actor,version=version+1,
   updated_at=clock_timestamp() WHERE id=w.id;
 SELECT COUNT(*)::integer INTO remaining FROM kitchen_work
  WHERE order_id=o.id AND outlet_id=p_outlet AND status<>'cancelled'
  AND (status<>'complete' OR released_at IS NULL);
 IF remaining=0 THEN
   UPDATE orders SET status='ready',version=version+1,updated_at=clock_timestamp()
     WHERE id=o.id AND restaurant_id=p_outlet AND status='preparing' AND version=o.version;
   IF NOT FOUND THEN RAISE EXCEPTION 'Stale order version' USING ERRCODE='40001'; END IF;
   INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
   VALUES(gen_random_uuid()::text,o.id,p_outlet,'preparing','ready','ready',
     'Final item released at Final Check','staff',actor);
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   VALUES(gen_random_uuid()::text,org,p_outlet,'order.status_changed',1,o.version+1,
     jsonb_build_object('orderId',o.id,'fromStatus','preparing','toStatus','ready'));
   order_ready:=true;
 END IF;
 n:=app_private.kitchen_emit(p_outlet,'work.changed',w.id);
 result:=jsonb_build_object('workId',w.id,'released',true,'orderId',o.id,'orderReady',order_ready,
   'version',w.version+1,'seq',n);
 INSERT INTO kitchen_command_receipts(outlet_id,request_key,action,target_id,expected_version,result,actor_id)
 VALUES(p_outlet,p_key,'work.release',p_work,p_expected,result,actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,actor,'kitchen.work.release',
  jsonb_build_object('workId',w.id,'orderId',o.id,'version',p_expected,'key',p_key,'seq',n,'orderReady',order_ready));
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_work_release(text,text,integer,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_work_release(text,text,integer,uuid) TO menuminute_app;

-- Order-level "Release all ready items": still requires every non-cancelled
-- item to be complete, marks the remainder released and moves the order to ready.
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
 OR NOT EXISTS (SELECT 1 FROM kitchen_work WHERE order_id=o.id AND outlet_id=p_outlet AND status<>'cancelled')
 OR EXISTS (SELECT 1 FROM kitchen_work WHERE order_id=o.id AND outlet_id=p_outlet AND status NOT IN ('complete','cancelled'))
 THEN RAISE EXCEPTION 'All station work must be complete; reconcile order status' USING ERRCODE='40001'; END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 IF o.status='accepted' THEN
   UPDATE orders SET status='preparing',version=version+1,updated_at=clock_timestamp()
     WHERE id=o.id AND restaurant_id=p_outlet AND status='accepted' AND version=p_expected;
   IF NOT FOUND THEN RAISE EXCEPTION 'Stale recovery attempt' USING ERRCODE='40001'; END IF;
   INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
   VALUES(gen_random_uuid()::text,o.id,p_outlet,'accepted','preparing','preparing',
     'Kitchen Pro reconciled completed station work before Final Check release','staff',actor);
   INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
   VALUES(gen_random_uuid()::text,org,p_outlet,'order.status_changed',1,o.version+1,
     jsonb_build_object('orderId',o.id,'fromStatus','accepted','toStatus','preparing'));
   o.version:=o.version+1;
   o.status:='preparing';
 END IF;
 UPDATE kitchen_work SET released_at=clock_timestamp(),released_by=actor,version=version+1,
   updated_at=clock_timestamp()
  WHERE order_id=o.id AND outlet_id=p_outlet AND status='complete' AND released_at IS NULL;
 UPDATE orders SET status='ready',version=version+1,updated_at=clock_timestamp()
 WHERE id=o.id AND restaurant_id=p_outlet AND status='preparing' AND version=o.version;
 IF NOT FOUND THEN RAISE EXCEPTION 'Stale order version' USING ERRCODE='40001'; END IF;
 INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
 VALUES(gen_random_uuid()::text,o.id,p_outlet,'preparing','ready','ready',
  'All kitchen items complete; released at Final Check','staff',actor);
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

-- Guest "Part ready" progress. Re-validates the tracking capability exactly like
-- track_guest_order and returns only counts (no dish, station or staff data).
CREATE OR REPLACE FUNCTION app_private.guest_order_release_progress(p_token text,p_order text,p_tracking text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE tracked jsonb; rel integer; total integer; st text;
BEGIN
 tracked:=app_private.track_guest_order(p_token,p_order,p_tracking);
 IF tracked IS NULL THEN RETURN NULL; END IF;
 SELECT status INTO st FROM orders WHERE id=p_order;
 IF st IS NULL OR st NOT IN ('accepted','preparing') THEN RETURN NULL; END IF;
 SELECT COUNT(*) FILTER (WHERE status<>'cancelled')::integer,
        COUNT(*) FILTER (WHERE status='complete' AND released_at IS NOT NULL)::integer
 INTO total,rel FROM kitchen_work WHERE order_id=p_order;
 IF total IS NULL OR total=0 OR rel=0 OR rel>=total THEN RETURN NULL; END IF;
 RETURN jsonb_build_object('released',rel,'total',total);
END $$;
REVOKE ALL ON FUNCTION app_private.guest_order_release_progress(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_order_release_progress(text,text,text) TO menuminute_app;

-- Merchant Orders desk / POS: released/total per kitchen-managed order.
CREATE OR REPLACE FUNCTION app_private.kitchen_release_progress(p_outlet text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT CASE WHEN current_setting('app.outlet_id',true)=p_outlet
 AND app_private.can_outlet(p_outlet,'orders.read')
 THEN COALESCE((SELECT jsonb_object_agg(q.order_id,jsonb_build_object('released',q.rel,'total',q.total))
  FROM (SELECT w.order_id,
    COUNT(*) FILTER (WHERE w.status<>'cancelled')::integer AS total,
    COUNT(*) FILTER (WHERE w.status='complete' AND w.released_at IS NOT NULL)::integer AS rel
   FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=p_outlet
   WHERE w.outlet_id=p_outlet AND o.status IN ('accepted','preparing')
   GROUP BY w.order_id) q WHERE q.rel>0 AND q.rel<q.total),'{}'::jsonb)
 ELSE '{}'::jsonb END
$$;
REVOKE ALL ON FUNCTION app_private.kitchen_release_progress(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_release_progress(text) TO menuminute_app;
