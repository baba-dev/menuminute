-- PWA H: additive, default-off Web Push delivery built from committed outbox events.
-- Push acceptance is never an order acknowledgement. No guest or financial data is stored.
CREATE TABLE pwa_push_subscriptions (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
 organization_id text NOT NULL REFERENCES organizations(id),
 outlet_id text NOT NULL REFERENCES restaurants(id),
 endpoint text NOT NULL CHECK (length(endpoint) BETWEEN 35 AND 2048),
 endpoint_hash text NOT NULL CHECK (endpoint_hash ~ '^[0-9a-f]{64}$'),
 new_orders boolean NOT NULL DEFAULT true,
 kitchen_updates boolean NOT NULL DEFAULT false,
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (endpoint_hash, outlet_id)
);
CREATE INDEX pwa_push_user_session ON pwa_push_subscriptions(user_id,session_id,outlet_id);
CREATE TABLE pwa_push_deliveries (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 event_id text NOT NULL,
 subscription_id text NOT NULL REFERENCES pwa_push_subscriptions(id) ON DELETE CASCADE,
 outlet_id text NOT NULL REFERENCES restaurants(id),
 kind text NOT NULL CHECK (kind IN ('order.created','kitchen.changed')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','gone','failed','expired')),
 attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 4),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token text,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE(event_id, subscription_id)
);
CREATE INDEX pwa_push_dispatch_due ON pwa_push_deliveries(next_attempt_at,created_at)
 WHERE status='pending';
CREATE INDEX pwa_push_delivery_retention ON pwa_push_deliveries(created_at);
ALTER TABLE pwa_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pwa_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON pwa_push_subscriptions,pwa_push_deliveries FROM PUBLIC,menuminute_app,menuminute_worker;

CREATE FUNCTION app_private.pwa_push_subscribe(p_outlet text,p_endpoint text,p_hash text,p_new boolean,p_kitchen boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=nullif(current_setting('app.actor_id',true),'');
 sess text:=nullif(current_setting('app.session_id',true),''); org text; ident text;
BEGIN
 IF actor IS NULL OR sess IS NULL OR p_outlet IS DISTINCT FROM current_setting('app.outlet_id',true)
  OR NOT app_private.can_outlet(p_outlet,'orders.read')
  OR p_hash !~ '^[0-9a-f]{64}$' OR length(p_endpoint) NOT BETWEEN 35 AND 2048
  OR p_new IS NULL OR p_kitchen IS NULL
  OR NOT EXISTS (SELECT 1 FROM sessions s WHERE s.id=sess AND s.user_id=actor AND s.expires_at>now())
 THEN RAISE EXCEPTION 'Push subscription is not authorized' USING ERRCODE='42501'; END IF;
 SELECT r.organization_id INTO org FROM restaurants r JOIN organizations o ON o.id=r.organization_id
 WHERE r.id=p_outlet AND r.is_active AND o.is_active;
 IF org IS NULL THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='42501'; END IF;
 -- One push endpoint cannot continue notifying a previous login on this device.
 DELETE FROM pwa_push_subscriptions WHERE endpoint_hash=p_hash AND user_id<>actor;
 INSERT INTO pwa_push_subscriptions(user_id,session_id,organization_id,outlet_id,endpoint,endpoint_hash,new_orders,kitchen_updates)
 VALUES(actor,sess,org,p_outlet,p_endpoint,p_hash,p_new,p_kitchen)
 ON CONFLICT(endpoint_hash,outlet_id) DO UPDATE SET
 user_id=excluded.user_id,session_id=excluded.session_id,organization_id=excluded.organization_id,
 endpoint=excluded.endpoint,new_orders=excluded.new_orders,kitchen_updates=excluded.kitchen_updates,
 enabled=true,updated_at=now() RETURNING id INTO ident;
 RETURN ident;
END $$;
REVOKE ALL ON FUNCTION app_private.pwa_push_subscribe(text,text,text,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pwa_push_subscribe(text,text,text,boolean,boolean) TO menuminute_app;

CREATE FUNCTION app_private.pwa_push_list(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=nullif(current_setting('app.actor_id',true),'');
 sess text:=nullif(current_setting('app.session_id',true),'');
BEGIN
 IF sess IS NULL OR actor IS NULL OR p_outlet IS DISTINCT FROM current_setting('app.outlet_id',true)
 OR NOT app_private.can_outlet(p_outlet,'orders.read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'endpointHash',endpoint_hash,
   'newOrders',new_orders,'kitchenUpdates',kitchen_updates,'updatedAt',updated_at))
   FROM pwa_push_subscriptions WHERE user_id=actor AND session_id=sess AND outlet_id=p_outlet AND enabled), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.pwa_push_list(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pwa_push_list(text) TO menuminute_app;

CREATE FUNCTION app_private.pwa_push_unsubscribe(p_outlet text,p_hash text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF nullif(current_setting('app.session_id',true),'') IS NULL
 OR p_outlet IS DISTINCT FROM current_setting('app.outlet_id',true)
 OR NOT app_private.can_outlet(p_outlet,'orders.read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 DELETE FROM pwa_push_subscriptions
 WHERE user_id=current_setting('app.actor_id',true) AND session_id=current_setting('app.session_id',true)
 AND outlet_id=p_outlet AND endpoint_hash=p_hash;
END $$;
REVOKE ALL ON FUNCTION app_private.pwa_push_unsubscribe(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pwa_push_unsubscribe(text,text) TO menuminute_app;

CREATE FUNCTION app_private.pwa_push_from_outbox()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.outlet_id IS NULL OR NEW.type NOT IN ('order.created','kitchen.changed')
 OR (NEW.type='kitchen.changed' AND COALESCE(NEW.payload->>'kind','') NOT IN ('work.created','work.changed'))
 THEN RETURN NEW; END IF;
 INSERT INTO pwa_push_deliveries(event_id,subscription_id,outlet_id,kind)
 SELECT NEW.id,s.id,NEW.outlet_id,NEW.type
 FROM pwa_push_subscriptions s
 WHERE s.outlet_id=NEW.outlet_id AND s.organization_id=NEW.organization_id AND s.enabled
 AND ((NEW.type='order.created' AND s.new_orders) OR
      (NEW.type='kitchen.changed' AND s.kitchen_updates))
 LIMIT 100;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.pwa_push_from_outbox() FROM PUBLIC;
CREATE TRIGGER pwa_push_order_event AFTER INSERT ON outbox_events
 FOR EACH ROW EXECUTE FUNCTION app_private.pwa_push_from_outbox();

-- Worker is isolated: it gets exactly one leased endpoint at a time, not table SELECT.
-- Subscriptions are checked AGAIN against current session, organization and outlet grants.
CREATE FUNCTION app_private.pwa_push_claim(p_outlets text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE chosen record; lease text:=gen_random_uuid()::text;
BEGIN
 IF p_outlets IS NULL OR cardinality(p_outlets) NOT BETWEEN 1 AND 50 THEN
 RAISE EXCEPTION 'Invalid push rollout' USING ERRCODE='22023'; END IF;
 UPDATE pwa_push_deliveries SET status='expired',processed_at=now(),lease_token=null,lease_until=null
 WHERE status='pending' AND created_at<now()-interval '10 minutes';
 SELECT d.id,s.endpoint,d.kind INTO chosen
 FROM pwa_push_deliveries d
 JOIN pwa_push_subscriptions s ON s.id=d.subscription_id AND s.enabled AND s.outlet_id=d.outlet_id
 JOIN sessions a ON a.id=s.session_id AND a.user_id=s.user_id AND a.expires_at>now()
 JOIN restaurants r ON r.id=s.outlet_id AND r.organization_id=s.organization_id AND r.is_active
 JOIN organizations o ON o.id=s.organization_id AND o.is_active
 JOIN organization_members m ON m.organization_id=o.id AND m.user_id=s.user_id AND m.is_active
 LEFT JOIN outlet_grants g ON g.organization_id=o.id AND g.member_id=m.id AND g.outlet_id=r.id
 WHERE d.status='pending' AND d.attempts<4 AND d.next_attempt_at<=now()
 AND (d.lease_until IS NULL OR d.lease_until<now())
 AND d.created_at>now()-interval '10 minutes'
 AND d.outlet_id=ANY(p_outlets)
 AND (m.role IN ('owner','admin') OR g.roles && ARRAY['manager','service','kitchen']::text[])
 AND ((d.kind='order.created' AND s.new_orders) OR (d.kind='kitchen.changed' AND s.kitchen_updates))
 ORDER BY d.next_attempt_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE pwa_push_deliveries SET attempts=attempts+1,lease_token=lease,
 lease_until=now()+interval '30 seconds' WHERE id=chosen.id;
 RETURN jsonb_build_object('id',chosen.id,'endpoint',chosen.endpoint,'lease',lease,'kind',chosen.kind);
END $$;
REVOKE ALL ON FUNCTION app_private.pwa_push_claim(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pwa_push_claim(text[]) TO menuminute_worker;

CREATE FUNCTION app_private.pwa_push_finish(p_id text,p_lease text,p_result text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE sub text;
BEGIN
 IF p_result NOT IN ('accepted','gone','retry','failed') THEN
 RAISE EXCEPTION 'Invalid delivery result' USING ERRCODE='22023'; END IF;
 UPDATE pwa_push_deliveries SET status=CASE WHEN p_result='retry' AND attempts<4 THEN 'pending'
 WHEN p_result='retry' THEN 'failed' ELSE p_result END,
 next_attempt_at=now()+make_interval(secs=>LEAST(120,power(2,attempts)::integer*10)),
 lease_token=null,lease_until=null,processed_at=CASE WHEN p_result='retry' AND attempts<4 THEN NULL ELSE now() END
 WHERE id=p_id AND lease_token=p_lease AND status='pending'
 RETURNING subscription_id INTO sub;
 IF p_result='gone' AND sub IS NOT NULL THEN
 UPDATE pwa_push_subscriptions SET enabled=false,updated_at=now() WHERE id=sub;
 END IF;
END $$;
REVOKE ALL ON FUNCTION app_private.pwa_push_finish(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pwa_push_finish(text,text,text) TO menuminute_worker;

CREATE FUNCTION app_private.pwa_push_prune()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 DELETE FROM pwa_push_deliveries WHERE created_at<now()-interval '3 days';
 DELETE FROM pwa_push_subscriptions WHERE updated_at<now()-interval '90 days'
 OR NOT EXISTS(SELECT 1 FROM sessions s WHERE s.id=session_id AND s.user_id=user_id AND s.expires_at>now());
END $$;
REVOKE ALL ON FUNCTION app_private.pwa_push_prune() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pwa_push_prune() TO menuminute_worker;
