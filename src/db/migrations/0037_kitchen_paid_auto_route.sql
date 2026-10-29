-- 0037: Provider-paid Kitchen Pro self-service. No per-merchant superadmin approval.
-- Checkout remains disabled until the platform operator approves the GLOBAL release
-- and configures verified Razorpay Kitchen subscriptions. No legacy edits.

CREATE TABLE app_private.kitchen_commercial_release (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 enabled boolean NOT NULL DEFAULT false,
 release_sha text CHECK(release_sha IS NULL OR release_sha ~ '^[a-f0-9]{40}$'),
 evidence_url text,
 approved_by text REFERENCES users(id) ON DELETE RESTRICT,
 approved_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
INSERT INTO app_private.kitchen_commercial_release(singleton,enabled) VALUES(true,false);
REVOKE ALL ON app_private.kitchen_commercial_release
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.kitchen_commerce_enabled() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT COALESCE((SELECT enabled FROM app_private.kitchen_commercial_release WHERE singleton),false)
$fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_commerce_enabled() FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_commerce_enabled() TO menuminute_app;

-- Bundled ordering grant is backed by the SAME verified Kitchen charge;
-- no separate payment is fabricated. Historical existing ordering grants remain.
CREATE TABLE app_private.kitchen_paid_ordering_grants (
 kitchen_grant_id text PRIMARY KEY REFERENCES entitlement_grants(id) ON DELETE RESTRICT,
 ordering_grant_id text NOT NULL UNIQUE REFERENCES entitlement_grants(id) ON DELETE RESTRICT
);
REVOKE ALL ON app_private.kitchen_paid_ordering_grants
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.kitchen_paid_subscription_active(p_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT app_private.kitchen_commerce_enabled() AND EXISTS(
   SELECT 1 FROM app_private.razorpay_subscriptions s
   JOIN app_private.razorpay_charges c ON c.subscription_id=s.subscription_id
   JOIN entitlement_grants e ON e.id=c.grant_id
   JOIN organizations o ON o.id=s.organization_id AND o.is_active
   WHERE s.organization_id=p_org AND s.product_key='kitchen_pro'
     AND s.status='active' AND s.current_end>clock_timestamp()
     AND e.capability='kitchen.new' AND e.revoked_at IS NULL
     AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()
 )
$fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_paid_subscription_active(text)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Whole-outlet readiness; no superadmin session needed in a billing webhook.
-- Unstaffed routed stations and missing published-dish routes fail closed.
CREATE FUNCTION app_private.kitchen_commercial_ready(p_outlet text) RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE org text; published_count integer; missing integer;
BEGIN
 SELECT r.organization_id INTO org FROM restaurants r
 JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE r.id=p_outlet AND r.is_active;
 IF org IS NULL OR NOT EXISTS(
   SELECT 1 FROM kitchen_stations WHERE outlet_id=p_outlet AND active
 ) OR NOT EXISTS (
   SELECT 1 FROM kitchen_station_members sm
   JOIN kitchen_stations st ON st.id=sm.station_id AND st.outlet_id=p_outlet AND st.active
   JOIN organization_members m ON m.id=sm.member_id AND m.organization_id=org AND m.is_active
   WHERE sm.outlet_id=p_outlet AND (m.role IN ('owner','admin') OR EXISTS (
     SELECT 1 FROM outlet_grants g WHERE g.member_id=m.id AND g.organization_id=org
       AND g.outlet_id=p_outlet AND g.roles && ARRAY['manager','kitchen']::text[]
   ))
 ) OR EXISTS(
   SELECT 1 FROM kitchen_stations st WHERE st.outlet_id=p_outlet AND st.active
   AND EXISTS(SELECT 1 FROM kitchen_routes kr WHERE kr.station_id=st.id AND kr.outlet_id=p_outlet)
   AND NOT EXISTS (
     SELECT 1 FROM kitchen_station_members sm
     JOIN organization_members m ON m.id=sm.member_id AND m.organization_id=org AND m.is_active
     WHERE sm.station_id=st.id AND sm.outlet_id=p_outlet
       AND (m.role IN ('owner','admin') OR EXISTS(
         SELECT 1 FROM outlet_grants g WHERE g.member_id=m.id AND g.organization_id=org
           AND g.outlet_id=p_outlet AND g.roles && ARRAY['manager','kitchen']::text[]
       ))
   )
 ) THEN RETURN false; END IF;
 WITH published AS(
   SELECT DISTINCT m.id, rel.document FROM menus m
   JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision
   WHERE NOT m.archived AND m.organization_id=org AND
     (m.outlet_id=p_outlet OR EXISTS(SELECT 1 FROM menu_assignments a
       WHERE a.menu_id=m.id AND a.outlet_id=p_outlet))
 ), dishes AS (
   SELECT DISTINCT dish->>'id' AS id FROM published p
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.document->'categories','[]'::jsonb)) cat
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cat->'items','[]'::jsonb)) dish
   WHERE NOT COALESCE((cat->>'archived')::boolean,false)
     AND NOT COALESCE((dish->>'archived')::boolean,false)
 )
 SELECT count(*)::int,
  count(*) FILTER(WHERE NOT EXISTS(
    SELECT 1 FROM kitchen_routes kr
    JOIN kitchen_stations st ON st.id=kr.station_id AND st.outlet_id=p_outlet AND st.active
    WHERE kr.outlet_id=p_outlet AND kr.dish_id=d.id
  ))::int INTO published_count,missing FROM dishes d;
 RETURN published_count>0 AND missing=0 AND EXISTS(
   SELECT 1 FROM entitlement_grants e WHERE e.organization_id=org
   AND e.capability='ordering.new' AND e.revoked_at IS NULL
   AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()
 );
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_commercial_ready(text)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Called by verified payment events, owner setup, and before accepted-order fan-out.
CREATE FUNCTION app_private.kitchen_auto_paid_activate(p_outlet text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE org text;
BEGIN
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet AND is_active;
 IF org IS NULL OR NOT app_private.kitchen_paid_subscription_active(org)
   OR NOT app_private.kitchen_commercial_ready(p_outlet)
   OR EXISTS(SELECT 1 FROM kitchen_pilot_outlets p WHERE p.outlet_id=p_outlet
     AND p.state IN ('requested','approved','active','draining'))
 THEN RETURN false; END IF;
 INSERT INTO kitchen_outlet_settings(outlet_id,enabled) VALUES(p_outlet,true)
 ON CONFLICT(outlet_id) DO UPDATE SET
 enabled=true,revision=kitchen_outlet_settings.revision+1,updated_at=clock_timestamp()
 WHERE NOT kitchen_outlet_settings.enabled;
 IF FOUND THEN PERFORM app_private.kitchen_emit(p_outlet,'settings.changed'); END IF;
 RETURN true;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_auto_paid_activate(text)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Paid readiness may complete after purchase; re-evaluate as stations/people/routes change.
CREATE FUNCTION app_private.kitchen_auto_paid_on_config() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 PERFORM app_private.kitchen_auto_paid_activate(COALESCE(NEW.outlet_id,OLD.outlet_id));
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_auto_paid_on_config() FROM PUBLIC;
CREATE TRIGGER kitchen_auto_paid_stations AFTER INSERT OR UPDATE OR DELETE ON kitchen_stations
 FOR EACH ROW EXECUTE FUNCTION app_private.kitchen_auto_paid_on_config();
CREATE TRIGGER kitchen_auto_paid_staff AFTER INSERT OR UPDATE OR DELETE ON kitchen_station_members
 FOR EACH ROW EXECUTE FUNCTION app_private.kitchen_auto_paid_on_config();
CREATE TRIGGER kitchen_auto_paid_routes AFTER INSERT OR UPDATE OR DELETE ON kitchen_routes
 FOR EACH ROW EXECUTE FUNCTION app_private.kitchen_auto_paid_on_config();

-- Preflight BEFORE the existing acceptance guard (lexicographic trigger order).
CREATE FUNCTION app_private.kitchen_auto_paid_before_accept() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 PERFORM app_private.kitchen_auto_paid_activate(NEW.restaurant_id);
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_auto_paid_before_accept() FROM PUBLIC;
CREATE TRIGGER kitchen_00_auto_paid_before_accept BEFORE UPDATE OF status ON orders
 FOR EACH ROW WHEN (NEW.status='accepted' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION app_private.kitchen_auto_paid_before_accept();

-- Platform-wide single approval, not a per-tenant admin operation.
CREATE FUNCTION app_private.kitchen_commercial_launch(p_sha text,p_evidence text,p_reason text,p_key text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); existing admin_command_receipts%ROWTYPE;
 email text; payload jsonb; result jsonb;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor)
 OR p_sha !~ '^[a-f0-9]{40}$'
 OR p_evidence !~ '^https://github[.]com/baba-dev/menuminute/(issues|pull)/[0-9]+'
 OR length(p_evidence)>500 OR length(btrim(p_reason)) NOT BETWEEN 20 AND 500
 OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 THEN RAISE EXCEPTION 'Invalid Kitchen commercial release approval' USING ERRCODE='42501'; END IF;
 payload:=jsonb_build_object('sha',p_sha,'evidence',p_evidence,'reason',p_reason);
 PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||p_key,0));
 SELECT * INTO existing FROM admin_command_receipts WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
   IF existing.action<>'kitchen.commercial.launch' OR existing.payload<>payload THEN
     RAISE EXCEPTION 'Kitchen launch key conflict' USING ERRCODE='23505'; END IF;
   RETURN existing.result;
 END IF;
 IF NOT app_private.require_step_up() THEN RAISE EXCEPTION
   'Fresh password and authenticator verification required' USING ERRCODE='42501'; END IF;
 SELECT email INTO email FROM users WHERE id=actor;
 UPDATE app_private.kitchen_commercial_release
 SET enabled=true,release_sha=p_sha,evidence_url=p_evidence,
     approved_by=actor,approved_at=clock_timestamp(),updated_at=clock_timestamp()
 WHERE singleton AND NOT enabled;
 IF NOT FOUND THEN RAISE EXCEPTION 'Kitchen commercial release already approved' USING ERRCODE='22023'; END IF;
 UPDATE subscription_plans SET is_active=true WHERE id='plan_kitchen_pro';
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,email,'kitchen.commercial.launch','platform','kitchen',
   jsonb_build_object('sha',p_sha,'evidence',p_evidence,'reason',p_reason));
 result:=jsonb_build_object('enabled',true,'releaseSha',p_sha);
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,'kitchen.commercial.launch','kitchen',payload,result);
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_commercial_launch(text,text,text,text)
 FROM PUBLIC,menuminute_worker,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.kitchen_commercial_launch(text,text,text,text) TO menuminute_app;


-- The billing writer receives only the already authorized function EXECUTE
-- permission from migration 0034; no additional direct table privileges.
CREATE OR REPLACE FUNCTION app_private.record_razorpay_charge(
  p_event text,p_subscription text,p_provider_plan text,p_payment text,
  p_start timestamptz,p_end timestamptz,p_provider_created timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE sub app_private.razorpay_subscriptions%ROWTYPE;
        existing text; grant_id text:=gen_random_uuid()::text;
        cap text;
BEGIN
  IF length(p_event) NOT BETWEEN 8 AND 128 OR length(p_payment) NOT BETWEEN 8 AND 128
    OR p_start IS NULL OR p_end IS NULL OR p_end<=p_start
    OR p_end>p_start+interval '40 days' OR p_end<=clock_timestamp()
    OR p_provider_created IS NULL
  THEN RAISE EXCEPTION 'Invalid captured subscription charge' USING ERRCODE='22023'; END IF;
  SELECT * INTO sub FROM app_private.razorpay_subscriptions
    WHERE subscription_id=p_subscription FOR UPDATE;
  IF NOT FOUND OR sub.provider_plan_id<>p_provider_plan THEN
    RAISE EXCEPTION 'Subscription is not eligible' USING ERRCODE='42501';
  END IF;
  SELECT c.grant_id INTO existing FROM app_private.razorpay_charges c
    WHERE c.event_id=p_event OR c.payment_id=p_payment;
  IF FOUND THEN RETURN existing; END IF;
  IF sub.status IN ('cancelled','completed','expired','paused','halted') THEN
    RAISE EXCEPTION 'Subscription is not eligible' USING ERRCODE='42501';
  END IF;
  IF sub.last_provider_event_at IS NOT NULL AND p_provider_created<sub.last_provider_event_at THEN
    RAISE EXCEPTION 'Stale payment event' USING ERRCODE='22023';
  END IF;
  cap:=CASE sub.product_key WHEN 'ordering' THEN 'ordering.new' ELSE 'kitchen.new' END;
  -- Only an operator-approved global Kitchen release allows provider-paid grants.
  IF cap='kitchen.new' AND NOT app_private.kitchen_commerce_enabled() THEN
    RAISE EXCEPTION 'Kitchen Pro paid release has not been approved' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM organizations WHERE id=sub.organization_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
  IF EXISTS(SELECT 1 FROM entitlement_grants e WHERE e.organization_id=sub.organization_id
    AND e.capability=cap AND e.revoked_at IS NULL AND e.starts_at<p_end AND e.ends_at>p_start)
  THEN RAISE EXCEPTION 'Overlapping subscription grant' USING ERRCODE='23505'; END IF;
  INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
  VALUES(grant_id,sub.organization_id,cap,'INR',p_start,p_end,'razorpay-webhook',
    'Verified Razorpay subscription charge '||p_payment,gen_random_uuid()::text);
  INSERT INTO app_private.razorpay_charges(event_id,subscription_id,payment_id,grant_id)
    VALUES(p_event,p_subscription,p_payment,grant_id);
  UPDATE app_private.razorpay_subscriptions SET status='active',current_start=p_start,
    current_end=p_end,last_provider_event_at=p_provider_created,updated_at=clock_timestamp()
    WHERE subscription_id=p_subscription;
  IF cap='kitchen.new' THEN
    -- A paid Kitchen Pro package includes ordering intake; this grant is only
    -- minted from the *same verified charge*, not a guessed account plan.
    IF NOT EXISTS (
       SELECT 1 FROM entitlement_grants e WHERE e.organization_id=sub.organization_id
        AND e.capability='ordering.new' AND e.revoked_at IS NULL
        AND e.starts_at<=p_start AND e.ends_at>=p_end
    ) THEN
      INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,
        starts_at,ends_at,operator,reason,request_key)
      VALUES(gen_random_uuid()::text,sub.organization_id,'ordering.new','INR',p_start,p_end,
        'razorpay-webhook','Kitchen Pro bundled ordering via verified charge '||p_payment,
        gen_random_uuid()::text)
      RETURNING id INTO existing;
      INSERT INTO app_private.kitchen_paid_ordering_grants(kitchen_grant_id,ordering_grant_id)
        VALUES(grant_id,existing);
    END IF;
    -- Ready outlets begin routing now. Unconfigured outlets remain on the
    -- merchant board until their station wizard completes.
    PERFORM app_private.kitchen_auto_paid_activate(r.id)
      FROM restaurants r WHERE r.organization_id=sub.organization_id AND r.is_active;
  END IF;
  RETURN grant_id;
END $$;

CREATE FUNCTION app_private.kitchen_bundle_revoke() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF OLD.capability='kitchen.new' AND OLD.operator='razorpay-webhook'
    AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
   UPDATE entitlement_grants SET revoked_at=clock_timestamp()
     WHERE id IN (
       SELECT g.ordering_grant_id FROM app_private.kitchen_paid_ordering_grants g
       WHERE g.kitchen_grant_id=OLD.id
     ) AND revoked_at IS NULL;
 END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_bundle_revoke() FROM PUBLIC;
CREATE TRIGGER kitchen_paid_bundle_revoke AFTER UPDATE OF revoked_at ON entitlement_grants
 FOR EACH ROW EXECUTE FUNCTION app_private.kitchen_bundle_revoke();

-- Merchant mode is the default when there is no current Kitchen entitlement,
-- even if historic setup/unfinished work keeps the enabled flag true.
CREATE OR REPLACE FUNCTION app_private.kitchen_accept_entitlement_check() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE org text; outlet_state text;
BEGIN
 -- Serialize intake with the operator's active->draining transition.
 SELECT state INTO outlet_state FROM kitchen_pilot_outlets
 WHERE outlet_id=NEW.restaurant_id FOR SHARE;
 IF outlet_state='draining' THEN
   RAISE EXCEPTION 'Kitchen draining; new acceptance paused' USING ERRCODE='42501';
 END IF;
 IF COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=NEW.restaurant_id),false) THEN
   IF outlet_state IS NOT NULL AND outlet_state<>'active'
     AND EXISTS(SELECT 1 FROM entitlement_grants e
       WHERE e.organization_id=(SELECT organization_id FROM restaurants WHERE id=NEW.restaurant_id)
         AND e.capability='kitchen.new' AND e.revoked_at IS NULL
         AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()) THEN
      RAISE EXCEPTION 'Kitchen activation state does not permit intake' USING ERRCODE='42501';
   END IF;
   SELECT organization_id INTO org FROM restaurants WHERE id=NEW.restaurant_id;
   -- An expired/paused/refunded paid term returns NEW orders to merchant
   -- processing. Previously accepted station work remains available to drain.
   -- Work fan-out independently checks active Kitchen entitlement.
   NULL;
 END IF;
 RETURN NEW;
END $fn$;

CREATE OR REPLACE FUNCTION app_private.kitchen_on_accept() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
 SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE item record; rt record; n integer; enabled boolean;
BEGIN
 IF NEW.status<>'accepted' OR OLD.status='accepted' THEN RETURN NEW; END IF;
 SELECT s.enabled INTO enabled FROM kitchen_outlet_settings s WHERE s.outlet_id=NEW.restaurant_id;
 IF NOT COALESCE(enabled,false) OR NOT EXISTS(
   SELECT 1 FROM entitlement_grants e JOIN restaurants r ON r.organization_id=e.organization_id
   WHERE r.id=NEW.restaurant_id AND e.capability='kitchen.new' AND e.revoked_at IS NULL
   AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()
 ) THEN RETURN NEW; END IF;
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
