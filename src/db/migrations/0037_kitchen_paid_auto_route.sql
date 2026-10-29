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
