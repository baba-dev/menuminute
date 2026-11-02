-- Guest "order ready" Web Push. Forward-only, additive, after 0104.
-- A diner may opt in, per order, to empty-payload push messages when that order's status changes.
-- Mirrors the staff design of 0058: no personal data and no order content are stored or sent, the
-- worker leases one endpoint at a time without table SELECT, and a push is never an order
-- acknowledgement. Subscriptions are bound to ONE order via its tracking capability, expire after
-- 24 hours, are never created for the public demo tenant, and cascade away with the order.
CREATE TABLE guest_push_subscriptions (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 organization_id text NOT NULL REFERENCES organizations(id),
 outlet_id text NOT NULL REFERENCES restaurants(id),
 order_id text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
 endpoint text NOT NULL CHECK (length(endpoint) BETWEEN 35 AND 2048),
 endpoint_hash text NOT NULL CHECK (endpoint_hash ~ '^[0-9a-f]{64}$'),
 enabled boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL,
 UNIQUE (order_id, endpoint_hash)
);
CREATE INDEX guest_push_sub_order ON guest_push_subscriptions(order_id) WHERE enabled;
CREATE INDEX guest_push_sub_expiry ON guest_push_subscriptions(expires_at);
CREATE TABLE guest_push_deliveries (
 id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
 event_id text NOT NULL,
 subscription_id text NOT NULL REFERENCES guest_push_subscriptions(id) ON DELETE CASCADE,
 outlet_id text NOT NULL REFERENCES restaurants(id),
 kind text NOT NULL CHECK (kind IN ('accepted','preparing','ready','rejected','cancelled')),
 status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','gone','failed','expired')),
 attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 4),
 next_attempt_at timestamptz NOT NULL DEFAULT now(),
 lease_token text,
 lease_until timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 UNIQUE (event_id, subscription_id)
);
CREATE INDEX guest_push_dispatch_due ON guest_push_deliveries(next_attempt_at,created_at)
 WHERE status='pending';
CREATE INDEX guest_push_delivery_retention ON guest_push_deliveries(created_at);
ALTER TABLE guest_push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE guest_push_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON guest_push_subscriptions, guest_push_deliveries FROM PUBLIC, menuminute_app, menuminute_worker;

CREATE FUNCTION app_private.guest_push_subscribe(
 p_token text, p_order text, p_tracking text, p_endpoint text, p_hash text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o record; v_order orders%ROWTYPE;
BEGIN
 IF p_token IS NULL OR p_order IS NULL OR p_tracking IS NULL OR p_hash IS NULL
    OR p_hash !~ '^[0-9a-f]{64}$' OR length(coalesce(p_endpoint,'')) NOT BETWEEN 35 AND 2048 THEN
   RAISE EXCEPTION 'Invalid push subscription' USING ERRCODE='22023';
 END IF;
 SELECT * INTO o FROM app_private.review_outlet(p_token);
 IF o.outlet_id IS NULL THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 IF o.is_demo THEN
   RAISE EXCEPTION 'The public demo does not send push notifications' USING ERRCODE='22023';
 END IF;
 SELECT * INTO v_order FROM orders
 WHERE id=p_order AND restaurant_id=o.outlet_id AND tracking_token=p_tracking FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 IF v_order.status IN ('served','collected','rejected','cancelled','expired') THEN
   RAISE EXCEPTION 'This order has finished' USING ERRCODE='22023';
 END IF;
 IF (SELECT count(*) FROM guest_push_subscriptions
     WHERE order_id=p_order AND endpoint_hash<>p_hash) >= 3 THEN
   RAISE EXCEPTION 'Device limit reached for this order' USING ERRCODE='22023';
 END IF;
 INSERT INTO guest_push_subscriptions(organization_id,outlet_id,order_id,endpoint,endpoint_hash,expires_at)
 VALUES(o.organization_id,o.outlet_id,p_order,p_endpoint,p_hash,now()+interval '24 hours')
 ON CONFLICT (order_id,endpoint_hash) DO UPDATE SET
   endpoint=EXCLUDED.endpoint, enabled=true, updated_at=now(), expires_at=EXCLUDED.expires_at;
 RETURN jsonb_build_object('subscribed',true);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_push_subscribe(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_push_subscribe(text,text,text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.guest_push_state(p_token text, p_order text, p_tracking text, p_hash text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o record;
BEGIN
 SELECT * INTO o FROM app_private.review_outlet(p_token);
 IF o.outlet_id IS NULL OR NOT EXISTS(
   SELECT 1 FROM orders WHERE id=p_order AND restaurant_id=o.outlet_id AND tracking_token=p_tracking
 ) THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('subscribed', p_hash ~ '^[0-9a-f]{64}$' AND EXISTS(
   SELECT 1 FROM guest_push_subscriptions
   WHERE order_id=p_order AND endpoint_hash=p_hash AND enabled AND expires_at>now()));
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_push_state(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_push_state(text,text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.guest_push_unsubscribe(p_token text, p_order text, p_tracking text, p_hash text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o record;
BEGIN
 SELECT * INTO o FROM app_private.review_outlet(p_token);
 IF o.outlet_id IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' OR NOT EXISTS(
   SELECT 1 FROM orders WHERE id=p_order AND restaurant_id=o.outlet_id AND tracking_token=p_tracking
 ) THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 DELETE FROM guest_push_subscriptions WHERE order_id=p_order AND endpoint_hash=p_hash;
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_push_unsubscribe(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_push_unsubscribe(text,text,text,text) TO menuminute_app;

-- Capture one delivery per subscribed device whenever the order's status moves. Optional
-- notifications must NEVER abort the canonical order transaction.
CREATE FUNCTION app_private.guest_push_from_status()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF NEW.to_status NOT IN ('accepted','preparing','ready','rejected','cancelled') THEN RETURN NEW; END IF;
 INSERT INTO guest_push_deliveries(event_id,subscription_id,outlet_id,kind)
 SELECT NEW.id,s.id,s.outlet_id,NEW.to_status FROM guest_push_subscriptions s
 WHERE s.order_id=NEW.order_id AND s.enabled AND s.expires_at>now()
 LIMIT 10
 ON CONFLICT (event_id,subscription_id) DO NOTHING;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 RAISE LOG 'Guest push capture skipped; canonical order event preserved';
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_push_from_status() FROM PUBLIC;
CREATE TRIGGER guest_push_order_status AFTER INSERT ON order_status_events
 FOR EACH ROW EXECUTE FUNCTION app_private.guest_push_from_status();

-- Worker lane. The role has no table privileges; it leases exactly one endpoint at a time and the
-- lease re-checks that the subscription, order outlet and organization are still live.
CREATE FUNCTION app_private.guest_push_claim(p_outlets text[])
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE chosen record; lease text:=gen_random_uuid()::text;
BEGIN
 IF p_outlets IS NULL OR cardinality(p_outlets) NOT BETWEEN 1 AND 50 THEN
   RAISE EXCEPTION 'Invalid push rollout' USING ERRCODE='22023';
 END IF;
 UPDATE guest_push_deliveries SET status='expired',processed_at=now(),lease_token=null,lease_until=null
 WHERE status='pending' AND created_at<now()-interval '10 minutes';
 SELECT d.id,s.endpoint INTO chosen
 FROM guest_push_deliveries d
 JOIN guest_push_subscriptions s ON s.id=d.subscription_id AND s.enabled
   AND s.expires_at>now() AND s.outlet_id=d.outlet_id
 JOIN restaurants r ON r.id=s.outlet_id AND r.organization_id=s.organization_id
   AND r.is_active AND NOT r.is_demo_data
 JOIN organizations o ON o.id=s.organization_id AND o.is_active
 WHERE d.status='pending' AND d.attempts<4 AND d.next_attempt_at<=now()
   AND (d.lease_until IS NULL OR d.lease_until<now())
   AND d.created_at>now()-interval '10 minutes'
   AND d.outlet_id=ANY(p_outlets)
 ORDER BY d.next_attempt_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE guest_push_deliveries SET attempts=attempts+1,lease_token=lease,
   lease_until=now()+interval '30 seconds' WHERE id=chosen.id;
 RETURN jsonb_build_object('id',chosen.id,'endpoint',chosen.endpoint,'lease',lease);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_push_claim(text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_push_claim(text[]) TO menuminute_worker;

CREATE FUNCTION app_private.guest_push_finish(p_id text, p_lease text, p_result text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE sub text;
BEGIN
 IF p_result NOT IN ('accepted','gone','retry','failed') THEN
   RAISE EXCEPTION 'Invalid delivery result' USING ERRCODE='22023';
 END IF;
 UPDATE guest_push_deliveries SET
   status=CASE WHEN p_result='retry' AND attempts<4 THEN 'pending'
               WHEN p_result='retry' THEN 'failed' ELSE p_result END,
   next_attempt_at=now()+make_interval(secs=>LEAST(120,power(2,attempts)::integer*10)),
   lease_token=null,lease_until=null,
   processed_at=CASE WHEN p_result='retry' AND attempts<4 THEN NULL ELSE now() END
 WHERE id=p_id AND lease_token=p_lease AND status='pending'
 RETURNING subscription_id INTO sub;
 IF p_result='gone' AND sub IS NOT NULL THEN
   UPDATE guest_push_subscriptions SET enabled=false,updated_at=now() WHERE id=sub;
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_push_finish(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_push_finish(text,text,text) TO menuminute_worker;

CREATE FUNCTION app_private.guest_push_prune()
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 DELETE FROM guest_push_deliveries WHERE created_at<now()-interval '3 days';
 DELETE FROM guest_push_subscriptions
 WHERE expires_at<now()-interval '1 day'
    OR (NOT enabled AND updated_at<now()-interval '1 day');
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_push_prune() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_push_prune() TO menuminute_worker;
