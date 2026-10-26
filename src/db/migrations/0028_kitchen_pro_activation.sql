-- Kitchen Pro controlled pilot activation. Forward-only, defaults to disabled.
-- No commercial launch permission is conferred by installing this migration.
CREATE TABLE kitchen_pilot_outlets (
 outlet_id text PRIMARY KEY REFERENCES restaurants(id) ON DELETE RESTRICT,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 state text NOT NULL DEFAULT 'requested'
   CHECK (state IN ('requested','approved','active','draining','disabled')),
 requested_by text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 approved_by text REFERENCES users(id) ON DELETE RESTRICT,
 release_sha text NOT NULL CHECK (release_sha ~ '^[a-f0-9]{40}$'),
 evidence_url text NOT NULL CHECK (length(evidence_url) BETWEEN 30 AND 500),
 reason text NOT NULL CHECK (length(reason) BETWEEN 10 AND 500),
 approved_at timestamptz,
 active_at timestamptz,
 expires_at timestamptz,
 revision integer NOT NULL DEFAULT 1 CHECK (revision>0),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT,
 CHECK (approved_by IS NULL OR approved_by<>requested_by),
 CHECK (state NOT IN ('approved','active','draining') OR approved_by IS NOT NULL)
);
CREATE INDEX kitchen_pilot_state_idx ON kitchen_pilot_outlets(state,updated_at);
ALTER TABLE kitchen_pilot_outlets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON kitchen_pilot_outlets FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE POLICY kitchen_pilot_admin_read ON kitchen_pilot_outlets
 FOR SELECT TO menuminute_app
 USING (app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),'')));
GRANT SELECT ON kitchen_pilot_outlets TO menuminute_app;

-- An operator cannot bypass the pilot state machine by calling the legacy
-- outlet manager's settings.disable action, even when there is no live work.
CREATE FUNCTION app_private.kitchen_protect_disable() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF OLD.enabled AND NOT NEW.enabled AND
    (EXISTS(SELECT 1 FROM kitchen_pilot_outlets p
            WHERE p.outlet_id=OLD.outlet_id AND p.state IN ('active','draining'))
     OR EXISTS(SELECT 1 FROM kitchen_work w JOIN orders o ON o.id=w.order_id
               WHERE w.outlet_id=OLD.outlet_id
                 AND o.status IN ('accepted','preparing')))
 THEN
   RAISE EXCEPTION 'Drain and finish all kitchen orders before disabling' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_protect_disable() FROM PUBLIC;
CREATE TRIGGER kitchen_protect_disable BEFORE UPDATE OF enabled ON kitchen_outlet_settings
 FOR EACH ROW EXECUTE FUNCTION app_private.kitchen_protect_disable();

-- Readiness is computed from the authoritative published release rather than
-- a mutable draft, with assigned menus included. Only current superadmins can
-- read this projection. No customer data/PII leaves this function.
CREATE FUNCTION app_private.kitchen_pilot_status(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE result jsonb; st integer; assigned integer; unmanned integer; dishes integer; missing integer;
        incomplete integer; ord_enabled boolean; kit_enabled boolean; enabled_flag boolean;
        pilot kitchen_pilot_outlets%ROWTYPE; org text;
BEGIN
 IF NOT app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),'')) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet AND is_active;
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM organizations WHERE id=org AND is_active) THEN
   RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='22023';
 END IF;
 SELECT * INTO pilot FROM kitchen_pilot_outlets WHERE outlet_id=p_outlet;
 SELECT count(*)::integer INTO st FROM kitchen_stations WHERE outlet_id=p_outlet AND active;
 SELECT count(DISTINCT sm.member_id)::integer INTO assigned
 FROM kitchen_station_members sm
 JOIN kitchen_stations s ON s.id=sm.station_id AND s.outlet_id=p_outlet AND s.active
 JOIN organization_members m ON m.id=sm.member_id AND m.is_active AND m.organization_id=org
 JOIN outlet_grants g ON g.member_id=m.id AND g.organization_id=org
   AND g.outlet_id=p_outlet AND g.roles && ARRAY['manager','kitchen']::text[]
 WHERE sm.outlet_id=p_outlet;
 SELECT count(*)::integer INTO unmanned FROM kitchen_stations s
 WHERE s.outlet_id=p_outlet AND s.active
 AND EXISTS (SELECT 1 FROM kitchen_routes kr WHERE kr.station_id=s.id AND kr.outlet_id=p_outlet)
 AND NOT EXISTS (
   SELECT 1 FROM kitchen_station_members sm
   JOIN organization_members m ON m.id=sm.member_id AND m.organization_id=org AND m.is_active
   JOIN outlet_grants g ON g.organization_id=org AND g.member_id=m.id
     AND g.outlet_id=p_outlet AND g.roles && ARRAY['manager','kitchen']::text[]
   WHERE sm.station_id=s.id AND sm.outlet_id=p_outlet
 );
 WITH published AS (
   SELECT DISTINCT m.id,rel.document
   FROM menus m JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision
   WHERE NOT m.archived AND m.organization_id=org AND
      (m.outlet_id=p_outlet OR EXISTS
        (SELECT 1 FROM menu_assignments a WHERE a.menu_id=m.id AND a.outlet_id=p_outlet))
 ),
 dish_ids AS (
   SELECT DISTINCT dish->>'id' AS dish_id
   FROM published p
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.document->'categories','[]'::jsonb)) cat
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cat->'items','[]'::jsonb)) dish
   WHERE COALESCE((cat->>'archived')::boolean,false)=false
     AND COALESCE((dish->>'archived')::boolean,false)=false
 )
 SELECT count(*)::integer,
        count(*) FILTER (WHERE NOT EXISTS
          (SELECT 1 FROM kitchen_routes kr
           JOIN kitchen_stations ks ON ks.id=kr.station_id AND ks.outlet_id=p_outlet AND ks.active
           WHERE kr.outlet_id=p_outlet AND kr.dish_id=dish_ids.dish_id))::integer
 INTO dishes,missing FROM dish_ids;
 SELECT count(DISTINCT o.id)::integer INTO incomplete
 FROM orders o JOIN kitchen_work w ON w.order_id=o.id AND w.outlet_id=p_outlet
 WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing');
 SELECT COALESCE(enabled,false) INTO enabled_flag FROM kitchen_outlet_settings WHERE outlet_id=p_outlet;
 -- Superadmin status is cross-tenant: entitlement_allowed() also requires
 -- organization membership, which a platform reviewer must not need.
 SELECT EXISTS (
   SELECT 1 FROM entitlement_grants g WHERE g.organization_id=org
     AND g.capability='ordering.new' AND g.revoked_at IS NULL
     AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp()
 ), EXISTS (
   SELECT 1 FROM entitlement_grants g WHERE g.organization_id=org
     AND g.capability='kitchen.new' AND g.revoked_at IS NULL
     AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp()
 ) INTO ord_enabled,kit_enabled;
 result:=jsonb_build_object(
   'outletId',p_outlet,'organizationId',org,
   'state',coalesce(pilot.state,'setup'),'revision',coalesce(pilot.revision,0),
   'releaseSha',pilot.release_sha,'evidenceUrl',pilot.evidence_url,
   'requestedBy',pilot.requested_by,'approvedBy',pilot.approved_by,
   'approvedAt',pilot.approved_at,'expiresAt',pilot.expires_at,
   'enabled',coalesce(enabled_flag,false),
   'activeStations',st,'assignedMembers',assigned,'unmannedStations',unmanned,
   'publishedDishes',dishes,'unroutedDishes',missing,
   'openKitchenOrders',incomplete,
   'orderingEntitled',coalesce(ord_enabled,false),
   'kitchenEntitled',coalesce(kit_enabled,false),
   'configurationReady',(st>0 AND assigned>0 AND unmanned=0 AND dishes>0 AND missing=0)
 );
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_pilot_status(text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_pilot_status(text) TO menuminute_app;

-- Independent operator approval is required. The evidence URL is a reference,
-- NOT proof automatically verified by the application. Activation is limited
-- to a 7-day operator-approved pilot, never a public subscription.
CREATE FUNCTION app_private.kitchen_pilot_command(
 p_outlet text,p_action text,p_data jsonb,p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),'');
  org text; op_email text; previous admin_command_receipts%ROWTYPE;
  pilot kitchen_pilot_outlets%ROWTYPE; readiness jsonb; reply jsonb;
  reason text:=btrim(coalesce(p_data->>'reason',''));
  sha text:=coalesce(p_data->>'releaseSha','');
  evidence text:=coalesce(p_data->>'evidenceUrl','');
  grant_id text;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor)
   OR p_action NOT IN ('request','approve','activate','drain','finalize')
   OR p_data IS NULL OR jsonb_typeof(p_data)<>'object'
   OR p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR length(reason) NOT BETWEEN 10 AND 500 THEN
    RAISE EXCEPTION 'Invalid or unauthorized pilot command' USING ERRCODE='42501';
 END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet AND is_active;
 IF org IS NULL THEN RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='22023'; END IF;
 SELECT email INTO op_email FROM users WHERE id=actor;
 PERFORM 1 FROM organizations WHERE id=org AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor||':'||p_key,0));
 SELECT * INTO previous FROM admin_command_receipts WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
   IF previous.action<>'kitchen.pilot.'||p_action OR previous.target_id<>p_outlet
     OR previous.payload<>p_data THEN
      RAISE EXCEPTION 'Pilot request-key conflict' USING ERRCODE='23505';
   END IF;
   RETURN previous.result;
 END IF;
 IF NOT app_private.require_step_up() THEN
    RAISE EXCEPTION 'Confirm a privileged action with password and authenticator' USING ERRCODE='42501';
 END IF;
 SELECT * INTO pilot FROM kitchen_pilot_outlets WHERE outlet_id=p_outlet FOR UPDATE;
 IF p_action='request' THEN
   IF sha !~ '^[a-f0-9]{40}$'
     OR evidence !~ '^https://github[.]com/baba-dev/menuminute/(issues|pull)/[0-9]+'
     OR length(evidence)>500 THEN
       RAISE EXCEPTION 'Evidence URL and exact release SHA required' USING ERRCODE='22023';
   END IF;
   IF pilot.state IN ('active','draining') THEN
       RAISE EXCEPTION 'Drain existing pilot before requesting a new release' USING ERRCODE='40001';
   END IF;
   INSERT INTO kitchen_pilot_outlets
     (outlet_id,organization_id,state,requested_by,approved_by,release_sha,evidence_url,reason,approved_at,expires_at)
   VALUES(p_outlet,org,'requested',actor,NULL,sha,evidence,reason,NULL,NULL)
   ON CONFLICT(outlet_id) DO UPDATE SET
     state='requested',requested_by=actor,approved_by=NULL,
     release_sha=sha,evidence_url=evidence,reason=EXCLUDED.reason,
     approved_at=NULL,expires_at=NULL,revision=kitchen_pilot_outlets.revision+1,
     updated_at=clock_timestamp();
 ELSIF p_action='approve' THEN
   IF pilot.state IS DISTINCT FROM 'requested' OR pilot.requested_by=actor
     OR pilot.release_sha<>sha OR pilot.evidence_url<>evidence THEN
     RAISE EXCEPTION 'Separate operator must review exact requested evidence and SHA'
       USING ERRCODE='42501';
   END IF;
   UPDATE kitchen_pilot_outlets SET
      state='approved',approved_by=actor,approved_at=clock_timestamp(),
      expires_at=clock_timestamp()+interval '24 hours',
      revision=revision+1,updated_at=clock_timestamp()
   WHERE outlet_id=p_outlet;
 ELSIF p_action='activate' THEN
   IF pilot.state IS DISTINCT FROM 'approved' OR pilot.release_sha<>sha
      OR pilot.approved_by IS NULL OR pilot.approved_by=pilot.requested_by
      OR pilot.expires_at<=clock_timestamp() THEN
     RAISE EXCEPTION 'Unapproved, expired or mismatched pilot release' USING ERRCODE='42501';
   END IF;
   readiness:=app_private.kitchen_pilot_status(p_outlet);
   IF NOT (readiness->>'configurationReady')::boolean
      OR NOT (readiness->>'orderingEntitled')::boolean
      OR (readiness->>'openKitchenOrders')::integer>0 THEN
     RAISE EXCEPTION 'Kitchen configuration, ordering entitlement or outstanding work blocks activation'
       USING ERRCODE='42501';
   END IF;
   -- No general Kitchen Pro grant may be issued from this command. Only a
   -- short approved pilot entitlement for this single organization's trial.
   SELECT id INTO grant_id FROM entitlement_grants
    WHERE organization_id=org AND capability='kitchen.new' AND revoked_at IS NULL
      AND starts_at<=clock_timestamp() AND ends_at>clock_timestamp()
    ORDER BY ends_at DESC LIMIT 1;
   -- An existing grant is not a loophole to turn a 7-day pilot into an
   -- indefinite organization-wide Kitchen entitlement. Reject any longer
   -- active grant, or a future overlapping reservation.
   IF grant_id IS NOT NULL AND EXISTS (
     SELECT 1 FROM entitlement_grants e WHERE e.id=grant_id
       AND e.ends_at>clock_timestamp()+interval '7 days'
   ) THEN
     RAISE EXCEPTION 'Existing Kitchen entitlement exceeds maximum pilot window'
       USING ERRCODE='42501';
   END IF;
   IF grant_id IS NULL AND EXISTS (
     SELECT 1 FROM entitlement_grants e
     WHERE e.organization_id=org AND e.capability='kitchen.new'
       AND e.revoked_at IS NULL
       AND e.starts_at<clock_timestamp()+interval '7 days'
       AND e.ends_at>clock_timestamp()
   ) THEN
     RAISE EXCEPTION 'Overlapping Kitchen entitlement requires review'
       USING ERRCODE='23505';
   END IF;
   IF grant_id IS NULL THEN
     grant_id:=gen_random_uuid()::text;
     INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,
       starts_at,ends_at,operator,reason,request_key)
     VALUES(grant_id,org,'kitchen.new','USD',clock_timestamp(),
       clock_timestamp()+interval '7 days',op_email,
       'Controlled pilot: '||left(reason,460),p_key);
   END IF;
   INSERT INTO kitchen_outlet_settings(outlet_id,enabled) VALUES(p_outlet,true)
    ON CONFLICT(outlet_id) DO UPDATE SET enabled=true,
       revision=kitchen_outlet_settings.revision+1,updated_at=clock_timestamp();
   UPDATE kitchen_pilot_outlets SET state='active',active_at=clock_timestamp(),
     revision=revision+1,updated_at=clock_timestamp() WHERE outlet_id=p_outlet;
   PERFORM app_private.kitchen_emit(p_outlet,'settings.changed');
 ELSIF p_action='drain' THEN
   IF pilot.state IS DISTINCT FROM 'active' THEN
     RAISE EXCEPTION 'Only active pilots may drain' USING ERRCODE='40001';
   END IF;
   -- Keep enabled true so already accepted work can start/complete/release.
   UPDATE kitchen_pilot_outlets SET state='draining',revision=revision+1,
      updated_at=clock_timestamp() WHERE outlet_id=p_outlet;
   PERFORM app_private.kitchen_emit(p_outlet,'settings.changed');
 ELSE
   IF pilot.state IS DISTINCT FROM 'draining' OR EXISTS(
     SELECT 1 FROM kitchen_work w JOIN orders o ON o.id=w.order_id
     WHERE w.outlet_id=p_outlet AND o.status IN ('accepted','preparing')
   ) THEN RAISE EXCEPTION 'Finish all accepted kitchen orders before finalizing drain'
      USING ERRCODE='40001'; END IF;
   UPDATE kitchen_pilot_outlets SET state='disabled',revision=revision+1,
     updated_at=clock_timestamp() WHERE outlet_id=p_outlet;
   UPDATE kitchen_outlet_settings SET enabled=false,revision=revision+1,
     updated_at=clock_timestamp() WHERE outlet_id=p_outlet;
   PERFORM app_private.kitchen_emit(p_outlet,'settings.changed');
 END IF;
 PERFORM app_private.record_org_change(org,'kitchen.pilot.'||p_action,p_outlet);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(
   gen_random_uuid()::text,org,actor,'kitchen.pilot.'||p_action,
   jsonb_build_object('outletId',p_outlet,'releaseSha',sha,'reason',reason,
     'evidenceUrl',CASE WHEN p_action IN ('request','approve') THEN evidence ELSE pilot.evidence_url END)
 );
 reply:=app_private.kitchen_pilot_status(p_outlet);
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,op_email,'kitchen.pilot.'||p_action,'kitchen',p_outlet,
   jsonb_build_object('reason',reason,'releaseSha',sha,'evidenceUrl',evidence));
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,'kitchen.pilot.'||p_action,p_outlet,p_data,reply);
 RETURN reply;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_pilot_command(text,text,jsonb,text)
 FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_pilot_command(text,text,jsonb,text)
 TO menuminute_app;

-- Kitchen acceptance is guarded even during drain. Pending orders cannot
-- silently change from KDS to non-KDS acceptance mid-flight.
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
   IF outlet_state IS NOT NULL AND outlet_state<>'active' THEN
      RAISE EXCEPTION 'Kitchen activation state does not permit intake' USING ERRCODE='42501';
   END IF;
   SELECT organization_id INTO org FROM restaurants WHERE id=NEW.restaurant_id;
   IF NOT EXISTS(SELECT 1 FROM entitlement_grants e
     WHERE e.organization_id=org AND e.capability='kitchen.new' AND e.revoked_at IS NULL
       AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()) THEN
      RAISE EXCEPTION 'Active Kitchen Pro entitlement required' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_accept_entitlement_check() FROM PUBLIC;
-- Critical: the trigger must actually be installed, before the existing AFTER
-- UPDATE fan-out. Without it, draining and expiry guards are dead code.
CREATE TRIGGER kitchen_accept_entitlement_guard
 BEFORE UPDATE OF status ON orders
 FOR EACH ROW WHEN (NEW.status='accepted' AND OLD.status IS DISTINCT FROM NEW.status)
 EXECUTE FUNCTION app_private.kitchen_accept_entitlement_check();

-- Reconcile setup navigation independently from the commercial entitlement.
-- The caller must already hold a scoped outlet role; disabled pilots cannot be
-- used to claim permission to prepare work.
CREATE FUNCTION app_private.kitchen_navigation(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE setup_allowed boolean; worker_allowed boolean; enabled_flag boolean;
        grant_active boolean; open_work boolean; org text; pilot_state text;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet OR
   NOT (app_private.can_outlet(p_outlet,'menu.read')
    OR app_private.can_outlet(p_outlet,'orders.read')
    OR app_private.can_outlet(p_outlet,'outlet.manage')) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 setup_allowed:=app_private.can_outlet(p_outlet,'outlet.manage');
 worker_allowed:=app_private.kitchen_access(p_outlet)
    AND app_private.can_outlet(p_outlet,'orders.prepare');
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 SELECT COALESCE(enabled,false) INTO enabled_flag
   FROM kitchen_outlet_settings WHERE outlet_id=p_outlet;
 SELECT state INTO pilot_state FROM kitchen_pilot_outlets WHERE outlet_id=p_outlet;
 grant_active:=app_private.entitlement_allowed(org,'kitchen.new');
 SELECT EXISTS(
   SELECT 1 FROM kitchen_work w JOIN orders o ON o.id=w.order_id
    WHERE w.outlet_id=p_outlet AND o.status IN ('accepted','preparing')
 ) INTO open_work;
 RETURN jsonb_build_object(
   'canSetup',setup_allowed,
   'canWork',worker_allowed,
   'operational',COALESCE(enabled_flag,false) AND worker_allowed AND
     (COALESCE(grant_active,false) OR open_work),
   'draining',COALESCE(enabled_flag,false) AND
     (pilot_state='draining' OR NOT COALESCE(grant_active,false) AND open_work),
   'active',COALESCE(enabled_flag,false)
 );
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_navigation(text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_navigation(text) TO menuminute_app;
