-- Kitchen Pro A-D. Expand-only: existing order/merchant flows remain valid with kitchen disabled.
-- No direct runtime table grants: scoped SECURITY DEFINER commands provide the only access.
CREATE TABLE kitchen_outlet_settings (
 outlet_id text PRIMARY KEY REFERENCES restaurants(id) ON DELETE RESTRICT,
 enabled boolean NOT NULL DEFAULT false,
 revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE kitchen_stations (
 id text PRIMARY KEY,
 outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
 name text NOT NULL CHECK(length(name) BETWEEN 2 AND 64),
 active boolean NOT NULL DEFAULT true,
 position integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(outlet_id,id),
 UNIQUE(outlet_id,name)
);
CREATE TABLE kitchen_station_members (
 outlet_id text NOT NULL,
 station_id text NOT NULL,
 member_id text NOT NULL,
 organization_id text NOT NULL,
 PRIMARY KEY(station_id,member_id),
 FOREIGN KEY(outlet_id,station_id) REFERENCES kitchen_stations(outlet_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(organization_id,member_id) REFERENCES organization_members(organization_id,id) ON DELETE RESTRICT,
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE kitchen_routes (
 outlet_id text NOT NULL,
 dish_id text NOT NULL CHECK(length(dish_id) BETWEEN 1 AND 128),
 station_id text NOT NULL,
 rule_version integer NOT NULL DEFAULT 1 CHECK(rule_version>0),
 PRIMARY KEY(outlet_id,dish_id,station_id),
 FOREIGN KEY(outlet_id,station_id) REFERENCES kitchen_stations(outlet_id,id) ON DELETE RESTRICT
);
CREATE TABLE kitchen_work (
 id text PRIMARY KEY,
 outlet_id text NOT NULL,
 order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 order_item_id text NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
 station_id text NOT NULL,
 rule_version integer NOT NULL,
 status text NOT NULL DEFAULT 'queued' CHECK(status IN ('queued','preparing','complete','cancelled')),
 version integer NOT NULL DEFAULT 0 CHECK(version>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(order_item_id,station_id),
 FOREIGN KEY(outlet_id,station_id) REFERENCES kitchen_stations(outlet_id,id) ON DELETE RESTRICT
);
CREATE INDEX kitchen_work_station_active ON kitchen_work(outlet_id,station_id,status,created_at);
CREATE INDEX kitchen_work_order_idx ON kitchen_work(order_id);
CREATE TABLE kitchen_event_counters (
 outlet_id text PRIMARY KEY REFERENCES restaurants(id) ON DELETE RESTRICT,
 last_seq bigint NOT NULL DEFAULT 0
);
CREATE TABLE kitchen_events (
 outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
 seq bigint NOT NULL CHECK(seq>0),
 event_id text NOT NULL UNIQUE,
 kind text NOT NULL CHECK(kind IN ('work.created','work.changed','station.changed','route.changed','settings.changed')),
 work_id text,
 actor_id text,
 occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(outlet_id,seq)
);
CREATE INDEX kitchen_events_outlet_time ON kitchen_events(outlet_id,occurred_at);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['kitchen_outlet_settings','kitchen_stations','kitchen_station_members',
   'kitchen_routes','kitchen_work','kitchen_event_counters','kitchen_events'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,menuminute_app,menuminute_worker',t);
 END LOOP;
END $$;

-- The outlet context and current live membership must be checked for every request.
CREATE FUNCTION app_private.kitchen_access(p_outlet text,p_station text DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT current_setting('app.outlet_id',true)=p_outlet
 AND app_private.can_outlet(p_outlet,'orders.read')
 AND EXISTS(
  SELECT 1 FROM restaurants r JOIN organization_members m ON m.organization_id=r.organization_id
  WHERE r.id=p_outlet AND m.user_id=current_setting('app.actor_id',true) AND m.is_active
  AND (m.role IN ('owner','admin')
    OR (app_private.can_outlet(p_outlet,'orders.prepare')
      AND EXISTS(SELECT 1 FROM kitchen_station_members sm
                 WHERE sm.outlet_id=p_outlet AND sm.member_id=m.id
                   AND (p_station IS NULL OR sm.station_id=p_station))))
 )
$$;
REVOKE ALL ON FUNCTION app_private.kitchen_access(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_access(text,text) TO menuminute_app;

-- Counter row is locked until commit, so sequence assignment follows commit order.
CREATE FUNCTION app_private.kitchen_emit(p_outlet text,p_kind text,p_work text DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n bigint; org text;
BEGIN
 INSERT INTO kitchen_event_counters(outlet_id,last_seq) VALUES(p_outlet,1)
 ON CONFLICT(outlet_id) DO UPDATE SET last_seq=kitchen_event_counters.last_seq+1 RETURNING last_seq INTO n;
 INSERT INTO kitchen_events(outlet_id,seq,event_id,kind,work_id,actor_id)
 VALUES(p_outlet,n,gen_random_uuid()::text,p_kind,p_work,NULLIF(current_setting('app.actor_id',true),''));
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,org,p_outlet,'kitchen.changed',1,1,
   jsonb_build_object('outletId',p_outlet,'seq',n,'kind',p_kind));
 RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_emit(text,text,text) FROM PUBLIC;

-- Station creation and mapping are administrative, explicitly scoped and audited.
CREATE FUNCTION app_private.kitchen_admin(p_outlet text,p_action text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org text; station text; member text; actor text:=NULLIF(current_setting('app.actor_id',true),''); result jsonb:='{}'::jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'outlet.manage') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet FOR SHARE;
 IF org IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid kitchen command' USING ERRCODE='22023'; END IF;
 IF p_action='station.create' THEN
   IF length(trim(p_data->>'name')) NOT BETWEEN 2 AND 64 THEN RAISE EXCEPTION 'Invalid station name' USING ERRCODE='22023'; END IF;
   station:='kst-'||gen_random_uuid()::text;
   INSERT INTO kitchen_stations(id,outlet_id,name) VALUES(station,p_outlet,trim(p_data->>'name'));
   result:=jsonb_build_object('stationId',station);
   PERFORM app_private.kitchen_emit(p_outlet,'station.changed');
 ELSIF p_action='station.rename' THEN
   UPDATE kitchen_stations SET name=trim(p_data->>'name')
    WHERE outlet_id=p_outlet AND id=p_data->>'stationId' AND active
      AND length(trim(p_data->>'name')) BETWEEN 2 AND 64;
   IF NOT FOUND THEN RAISE EXCEPTION 'Station unavailable' USING ERRCODE='22023'; END IF;
   PERFORM app_private.kitchen_emit(p_outlet,'station.changed');
 ELSIF p_action='member.assign' OR p_action='member.remove' THEN
   station:=p_data->>'stationId'; member:=p_data->>'memberId';
   IF NOT EXISTS(SELECT 1 FROM kitchen_stations WHERE outlet_id=p_outlet AND id=station AND active)
   OR NOT EXISTS(SELECT 1 FROM organization_members m JOIN outlet_grants g
     ON g.organization_id=m.organization_id AND g.member_id=m.id AND g.outlet_id=p_outlet
     WHERE m.id=member AND m.organization_id=org AND m.is_active
       AND g.roles && ARRAY['manager','kitchen']::text[]) THEN
      RAISE EXCEPTION 'Unassigned member or station' USING ERRCODE='22023'; END IF;
   IF p_action='member.assign' THEN
    INSERT INTO kitchen_station_members(outlet_id,station_id,member_id,organization_id)
    VALUES(p_outlet,station,member,org) ON CONFLICT DO NOTHING;
   ELSE
    DELETE FROM kitchen_station_members WHERE outlet_id=p_outlet AND station_id=station AND member_id=member;
   END IF;
   PERFORM app_private.kitchen_emit(p_outlet,'station.changed');
 ELSIF p_action='route.assign' OR p_action='route.remove' THEN
   station:=p_data->>'stationId';
   IF length(p_data->>'dishId') NOT BETWEEN 1 AND 128
      OR NOT EXISTS(SELECT 1 FROM kitchen_stations WHERE outlet_id=p_outlet AND id=station AND active) THEN
     RAISE EXCEPTION 'Invalid route' USING ERRCODE='22023'; END IF;
   IF p_action='route.assign' THEN
     INSERT INTO kitchen_routes(outlet_id,dish_id,station_id) VALUES(p_outlet,p_data->>'dishId',station)
     ON CONFLICT(outlet_id,dish_id,station_id) DO UPDATE SET rule_version=kitchen_routes.rule_version+1;
   ELSE
     DELETE FROM kitchen_routes WHERE outlet_id=p_outlet AND dish_id=p_data->>'dishId' AND station_id=station;
   END IF;
   PERFORM app_private.kitchen_emit(p_outlet,'route.changed');
 ELSIF p_action='settings.enable' OR p_action='settings.disable' THEN
   IF p_action='settings.enable' AND (NOT EXISTS(
     SELECT 1 FROM entitlement_grants g WHERE g.organization_id=org AND g.capability='kitchen.new'
      AND g.revoked_at IS NULL AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp())
     OR NOT EXISTS(SELECT 1 FROM kitchen_routes kr JOIN kitchen_stations ks ON ks.id=kr.station_id
       WHERE kr.outlet_id=p_outlet AND ks.active)) THEN
      RAISE EXCEPTION 'Kitchen entitlement and routing are required' USING ERRCODE='42501'; END IF;
   INSERT INTO kitchen_outlet_settings(outlet_id,enabled) VALUES(p_outlet,p_action='settings.enable')
   ON CONFLICT(outlet_id) DO UPDATE SET enabled=excluded.enabled,revision=kitchen_outlet_settings.revision+1,updated_at=now();
   PERFORM app_private.kitchen_emit(p_outlet,'settings.changed');
 ELSE RAISE EXCEPTION 'Unknown kitchen action' USING ERRCODE='22023'; END IF;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,actor,'kitchen.'||p_action,p_data);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_admin(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_admin(text,text,jsonb) TO menuminute_app;

-- Accepted orders fan out once, in the SAME transaction as the canonical order transition.
-- Missing routing aborts acceptance rather than creating invisible or incomplete kitchen work.
CREATE FUNCTION app_private.kitchen_on_accept() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE item record; rt record; n integer; enabled boolean;
BEGIN
 IF NEW.status<>'accepted' OR OLD.status='accepted' THEN RETURN NEW; END IF;
 SELECT s.enabled INTO enabled FROM kitchen_outlet_settings s WHERE s.outlet_id=NEW.restaurant_id;
 IF NOT COALESCE(enabled,false) THEN RETURN NEW; END IF;
 FOR item IN SELECT * FROM order_items WHERE order_id=NEW.id LOOP
   n:=0;
   FOR rt IN SELECT r.station_id,r.rule_version FROM kitchen_routes r
     JOIN kitchen_stations s ON s.id=r.station_id AND s.outlet_id=r.outlet_id AND s.active
     WHERE r.outlet_id=NEW.restaurant_id AND r.dish_id=item.dish_id LOOP
      INSERT INTO kitchen_work(id,outlet_id,order_id,order_item_id,station_id,rule_version)
      VALUES('kw-'||gen_random_uuid()::text,NEW.restaurant_id,NEW.id,item.id,rt.station_id,rt.rule_version)
      ON CONFLICT(order_item_id,station_id) DO NOTHING;
      n:=n+1;
   END LOOP;
   IF n=0 THEN RAISE EXCEPTION 'Unrouted kitchen item; acceptance blocked' USING ERRCODE='22023'; END IF;
 END LOOP;
 FOR item IN SELECT id FROM kitchen_work WHERE order_id=NEW.id LOOP
   PERFORM app_private.kitchen_emit(NEW.restaurant_id,'work.created',item.id);
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_on_accept() FROM PUBLIC;
CREATE TRIGGER kitchen_accept_order AFTER UPDATE OF status ON orders
 FOR EACH ROW WHEN (NEW.status='accepted' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION app_private.kitchen_on_accept();

-- Terminal order transitions invalidate open station work and wake SSE consumers.
-- Reuse canonical order update's lock order: orders, then kitchen_work.
CREATE FUNCTION app_private.kitchen_on_terminal() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public,pg_temp AS $
DECLARE w record;
BEGIN
 FOR w IN SELECT id,status FROM kitchen_work WHERE order_id=NEW.id ORDER BY id FOR UPDATE LOOP
  IF NEW.status IN ('cancelled','rejected','expired') AND w.status IN ('queued','preparing') THEN
   UPDATE kitchen_work SET status='cancelled',version=version+1,updated_at=clock_timestamp() WHERE id=w.id;
  END IF;
  PERFORM app_private.kitchen_emit(NEW.restaurant_id,'work.changed',w.id);
 END LOOP;
 RETURN NEW;
END $;
REVOKE ALL ON FUNCTION app_private.kitchen_on_terminal() FROM PUBLIC;
CREATE TRIGGER kitchen_terminal_order AFTER UPDATE OF status ON orders
 FOR EACH ROW WHEN (NEW.status IN ('cancelled','rejected','expired','ready','served','collected')
   AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION app_private.kitchen_on_terminal();

-- Existing merchant Ready action must not bypass required station work.
CREATE OR REPLACE FUNCTION app_private.transition_order(p_outlet text,p_order text,p_target text,
 p_expected integer,p_reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v orders%ROWTYPE; v_org text; v_permission text;
BEGIN
 v_permission:=CASE WHEN p_target='preparing' THEN 'orders.prepare'
 WHEN p_target IN ('ready','served','collected') THEN 'orders.complete'
 WHEN p_target IN ('rejected','cancelled') THEN 'orders.cancel' ELSE 'orders.accept' END;
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,v_permission) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
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
 IF p_target='ready' AND EXISTS(SELECT 1 FROM kitchen_work WHERE order_id=v.id) THEN
   RAISE EXCEPTION 'Kitchen Pro expeditor release required' USING ERRCODE='42501'; END IF;
 IF NOT ((v.status='pending' AND p_target IN ('accepted','rejected'))
  OR (v.status='accepted' AND p_target IN ('preparing','cancelled'))
  OR (v.status='preparing' AND p_target IN ('ready','cancelled'))
  OR (v.status='ready' AND (p_target='cancelled' OR
    (v.fulfillment_mode='pickup' AND p_target='collected') OR
    (v.fulfillment_mode='dine_in' AND p_target='served')))) THEN
  RAISE EXCEPTION 'Invalid order transition' USING ERRCODE='22023'; END IF;
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

-- Station commands cannot silently release guest orders or modify payment.
CREATE FUNCTION app_private.kitchen_work_command(p_outlet text,p_work text,p_action text,p_expected integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE w kitchen_work%ROWTYPE; o orders%ROWTYPE; next_state text; n bigint; org text;
BEGIN
 -- Always lock the canonical order BEFORE station work, consistent with transition_order.
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet;
 IF w.id IS NULL OR NOT app_private.can_outlet(p_outlet,'orders.prepare')
 OR NOT app_private.kitchen_access(p_outlet,w.station_id) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM orders WHERE id=w.order_id AND restaurant_id=p_outlet FOR UPDATE;
 SELECT * INTO w FROM kitchen_work WHERE id=p_work AND outlet_id=p_outlet FOR UPDATE;
 IF o.id IS NULL OR o.status IN ('pending','rejected','cancelled','expired','ready','served','collected')
 OR w.version<>p_expected THEN RAISE EXCEPTION 'Stale kitchen work' USING ERRCODE='40001'; END IF;
 next_state:=CASE WHEN p_action='start' AND w.status='queued' THEN 'preparing'
 WHEN p_action='complete' AND w.status='preparing' THEN 'complete' ELSE NULL END;
 IF next_state IS NULL THEN RAISE EXCEPTION 'Invalid kitchen action' USING ERRCODE='22023'; END IF;
 UPDATE kitchen_work SET status=next_state,version=version+1,updated_at=clock_timestamp() WHERE id=w.id;
 n:=app_private.kitchen_emit(p_outlet,'work.changed',w.id);
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,current_setting('app.actor_id',true),'kitchen.work.'||p_action,
 jsonb_build_object('workId',w.id,'orderId',w.order_id,'expectedVersion',p_expected,'seq',n));
 RETURN jsonb_build_object('workId',w.id,'status',next_state,'version',p_expected+1,'seq',n);
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_work_command(text,text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_work_command(text,text,text,integer) TO menuminute_app;

-- Snapshot and cursor are read inside the same statement. Event payloads do not expose guest PII.
CREATE FUNCTION app_private.kitchen_snapshot(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb; is_admin boolean; member text;
BEGIN
 IF NOT app_private.kitchen_access(p_outlet) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT m.id,m.role IN ('owner','admin') INTO member,is_admin
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
 'work',COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',w.id,'stationId',w.station_id,'orderId',w.order_id,'orderNumber',o.order_number,
   'fulfillmentMode',o.fulfillment_mode,'tableLabel',t.table_number,'brandLabel',r.name,
   'dishName',i.item_name,'quantity',i.quantity,'variantName',i.variant_name,
   'selectedOptions',i.selected_options,'notes',i.notes,'orderNotes',o.notes,
   'status',w.status,'version',w.version,'createdAt',w.created_at,'updatedAt',w.updated_at)
   ORDER BY w.created_at,w.id)
  FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=p_outlet
  JOIN order_items i ON i.id=w.order_item_id JOIN restaurants r ON r.id=p_outlet
  LEFT JOIN restaurant_tables t ON t.id=o.table_id
  WHERE w.outlet_id=p_outlet AND w.status IN ('queued','preparing','complete')
   AND o.status IN ('accepted','preparing')
   AND (is_admin OR EXISTS(SELECT 1 FROM kitchen_station_members sm
     WHERE sm.station_id=w.station_id AND sm.member_id=member))
  ),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_snapshot(text) TO menuminute_app;

CREATE FUNCTION app_private.kitchen_changes(p_outlet text,p_after bigint,p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE last_seen bigint; events jsonb; first_available bigint;
BEGIN
 IF NOT app_private.kitchen_access(p_outlet) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_after<0 OR p_limit NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023'; END IF;
 SELECT COALESCE(last_seq,0) INTO last_seen FROM kitchen_event_counters WHERE outlet_id=p_outlet;
 last_seen:=COALESCE(last_seen,0);
 IF p_after>last_seen THEN RAISE EXCEPTION 'Future cursor' USING ERRCODE='22023'; END IF;
 SELECT MIN(seq) INTO first_available FROM kitchen_events WHERE outlet_id=p_outlet;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('seq',e.seq,'kind',e.kind) ORDER BY e.seq),'[]'::jsonb)
 INTO events FROM (SELECT seq,kind FROM kitchen_events WHERE outlet_id=p_outlet AND seq>p_after ORDER BY seq LIMIT p_limit) e;
 RETURN jsonb_build_object('cursor',last_seen,'resync',p_after>0 AND first_available IS NOT NULL
   AND p_after<first_available-1,'events',events);
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_changes(text,bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_changes(text,bigint,integer) TO menuminute_app;
