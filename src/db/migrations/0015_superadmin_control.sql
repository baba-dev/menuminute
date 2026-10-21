-- Superadmin & Platform Control Plane: additive migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS users_super_admin_idx ON users(is_super_admin) WHERE is_super_admin;

-- Better Auth retains its existing user-row INSERT/UPDATE grants. A SECURITY
-- INVOKER trigger prevents that runtime role from changing the privileged bit,
-- including on registration; the vetted SECURITY DEFINER command can change it.
CREATE FUNCTION app_private.protect_superadmin_role() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public,pg_temp AS $protect$
BEGIN
 IF current_user='menuminute_app' THEN
   IF TG_OP='INSERT' AND NEW.is_super_admin THEN
     RAISE EXCEPTION 'Superadmin cannot be assigned through registration' USING ERRCODE='42501';
   ELSIF TG_OP='UPDATE' AND NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
     RAISE EXCEPTION 'Use the audited platform command for role changes' USING ERRCODE='42501';
   END IF;
 END IF;
 RETURN NEW;
END $protect$;
REVOKE ALL ON FUNCTION app_private.protect_superadmin_role() FROM PUBLIC;
CREATE TRIGGER users_protect_superadmin BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION app_private.protect_superadmin_role();


-- Automatically mark approved superadmin email
UPDATE users SET is_super_admin = true WHERE email = 'admin@bababuilds.com';

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id text PRIMARY KEY,
  actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_email text NOT NULL,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id text,
  details jsonb,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_audit_actor_idx ON admin_audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS admin_audit_action_idx ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS admin_audit_created_idx ON admin_audit_logs(created_at);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs FORCE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION app_private.is_super_admin(p_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT EXISTS(SELECT 1 FROM users WHERE id=p_user AND is_super_admin);
$$;

REVOKE ALL ON FUNCTION app_private.is_super_admin(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_super_admin(text) TO menuminute_app;

CREATE POLICY admin_audit_read ON admin_audit_logs FOR SELECT USING (
  app_private.is_super_admin(current_setting('app.actor_id', true))
);

CREATE POLICY admin_audit_insert ON admin_audit_logs FOR INSERT WITH CHECK (
  actor_id = current_setting('app.actor_id', true) AND app_private.is_super_admin(current_setting('app.actor_id', true))
);

GRANT SELECT, INSERT ON admin_audit_logs TO menuminute_app;

-- The existing tenant-scoped SELECT policies remain unchanged. Platform operators
-- receive global read visibility only after the server sets an authenticated
-- actor inside a transaction (withActor); an unset actor remains fail-closed.
DO $$ DECLARE table_name text; BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'organizations', 'organization_members', 'brands', 'restaurants',
    'orders', 'restaurant_subscriptions', 'entitlement_grants', 'outbox_events', 'domain_projections'
  ] LOOP
    EXECUTE format(
      'CREATE POLICY platform_admin_global_read ON %I FOR SELECT TO menuminute_app USING (app_private.is_super_admin(current_setting(''app.actor_id'', true)))',
      table_name
    );
  END LOOP;
END $$;

-- All platform writes use one narrow, idempotent, audited SECURITY DEFINER entrypoint.
-- No direct app-role UPDATE/INSERT is granted on tenant, billing, or queue tables.
CREATE TABLE admin_command_receipts (
 actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 request_key text NOT NULL CHECK (request_key ~ '^[0-9a-f-]{36}$'),
 action text NOT NULL,
 target_id text NOT NULL,
 payload jsonb NOT NULL,
 result jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(actor_id,request_key)
);
REVOKE ALL ON admin_command_receipts FROM PUBLIC,menuminute_app,menuminute_worker;

-- The explicit live session is required even for global platform SELECT policies.
CREATE OR REPLACE FUNCTION app_private.is_super_admin(p_user text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(
   SELECT 1 FROM users u JOIN sessions s ON s.user_id=u.id
   WHERE u.id=p_user AND u.is_super_admin AND u.email_verified AND u.two_factor_enabled
   AND s.id=NULLIF(current_setting('app.session_id',true),'')
   AND s.expires_at>clock_timestamp()
 );
$$;

CREATE FUNCTION app_private.admin_command(
 p_action text,p_target text,p_data jsonb,p_key text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
 actor text:=NULLIF(current_setting('app.actor_id',true),'');
 email_address text;
 old_receipt admin_command_receipts%ROWTYPE;
 org organizations%ROWTYPE;
 grant_row entitlement_grants%ROWTYPE;
 target_user users%ROWTYPE;
 result jsonb:='{}'::jsonb;
 identifier text;
 affected integer;
 reason text:=btrim(coalesce(p_data->>'reason',''));
 started timestamptz;
 ended timestamptz;
BEGIN
 IF actor IS NULL OR NOT app_private.is_super_admin(actor)
   OR p_key IS NULL OR p_key !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   OR p_target IS NULL OR length(p_target) NOT BETWEEN 1 AND 254
   OR p_data IS NULL OR jsonb_typeof(p_data)<>'object'
 THEN RAISE EXCEPTION 'Invalid or unauthorized administrative command' USING ERRCODE='42501'; END IF;
 SELECT email INTO email_address FROM users WHERE id=actor;
 PERFORM pg_advisory_xact_lock(hashtextextended(actor || ':' || p_key,0));
 SELECT * INTO old_receipt FROM admin_command_receipts WHERE actor_id=actor AND request_key=p_key;
 IF FOUND THEN
   IF old_receipt.action<>p_action OR old_receipt.target_id<>p_target OR old_receipt.payload<>p_data THEN
     RAISE EXCEPTION 'Administrative request key conflict' USING ERRCODE='23505'; END IF;
   RETURN old_receipt.result;
 END IF;
 -- Uses the native one-use, 5-minute password + TOTP proof for EVERY platform mutation.
 IF NOT app_private.require_step_up() THEN
   RAISE EXCEPTION 'Confirm a recent privileged action at /account/security first' USING ERRCODE='42501';
 END IF;
 IF p_action IN ('organization.active','organization.mfa') THEN
   IF p_action='organization.active' AND (jsonb_typeof(p_data->'isActive')<>'boolean'
       OR length(reason) NOT BETWEEN 5 AND 500) THEN
     RAISE EXCEPTION 'Invalid suspension/reactivation justification' USING ERRCODE='22023'; END IF;
   IF p_action='organization.mfa' AND jsonb_typeof(p_data->'mfaRequired')<>'boolean' THEN
     RAISE EXCEPTION 'Invalid MFA policy' USING ERRCODE='22023'; END IF;
   SELECT * INTO org FROM organizations WHERE id=p_target FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unknown organization' USING ERRCODE='22023'; END IF;
   IF p_action='organization.active' THEN
     IF org.is_active=(p_data->>'isActive')::boolean THEN
       RAISE EXCEPTION 'Organization already has requested status' USING ERRCODE='22023'; END IF;
     UPDATE organizations SET is_active=(p_data->>'isActive')::boolean WHERE id=p_target;
   ELSE
     IF org.mfa_required=(p_data->>'mfaRequired')::boolean THEN
       RAISE EXCEPTION 'MFA policy is unchanged' USING ERRCODE='22023'; END IF;
     UPDATE organizations SET mfa_required=(p_data->>'mfaRequired')::boolean WHERE id=p_target;
   END IF;
   PERFORM app_private.record_org_change(p_target,p_action,NULL);
   result:=jsonb_build_object('id',p_target,'name',org.name,
      'isActive',coalesce((p_data->>'isActive')::boolean,org.is_active),
      'mfaRequired',coalesce((p_data->>'mfaRequired')::boolean,org.mfa_required));
 ELSIF p_action='entitlement.grant' THEN
   IF length(reason) NOT BETWEEN 5 AND 500
     OR p_data->>'capability' NOT IN ('ordering.new','kitchen.new')
     OR p_data->>'billingCurrency' NOT IN ('USD','INR') THEN
     RAISE EXCEPTION 'Invalid entitlement request' USING ERRCODE='22023'; END IF;
   -- Kitchen Pro remains commercially unavailable until its independent release gate.
   IF p_data->>'capability'='kitchen.new' THEN
     RAISE EXCEPTION 'Kitchen Pro commercial activation is not approved' USING ERRCODE='42501'; END IF;
   started:=(p_data->>'startsAt')::timestamptz;
   ended:=(p_data->>'endsAt')::timestamptz;
   IF started IS NULL OR ended IS NULL OR ended<=started OR ended<=clock_timestamp() THEN
     RAISE EXCEPTION 'Invalid UTC entitlement window' USING ERRCODE='22023'; END IF;
   SELECT * INTO org FROM organizations WHERE id=p_target FOR UPDATE;
   IF NOT FOUND OR NOT org.is_active THEN RAISE EXCEPTION 'Active organization required' USING ERRCODE='22023'; END IF;
   IF EXISTS(SELECT 1 FROM entitlement_grants WHERE organization_id=p_target AND capability=p_data->>'capability'
      AND revoked_at IS NULL AND starts_at<ended AND ends_at>started) THEN
     RAISE EXCEPTION 'Overlapping entitlement already exists' USING ERRCODE='23505'; END IF;
   identifier:=gen_random_uuid()::text;
   INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
   VALUES(identifier,p_target,p_data->>'capability',p_data->>'billingCurrency',started,ended,email_address,reason,p_key);
   PERFORM app_private.record_org_change(p_target,p_action,NULL);
   result:=jsonb_build_object('id',identifier);
 ELSIF p_action='entitlement.revoke' THEN
   IF length(reason) NOT BETWEEN 5 AND 500 THEN RAISE EXCEPTION 'Revocation justification required' USING ERRCODE='22023'; END IF;
   SELECT * INTO grant_row FROM entitlement_grants WHERE id=p_target;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unknown entitlement' USING ERRCODE='22023'; END IF;
   PERFORM 1 FROM organizations WHERE id=grant_row.organization_id FOR UPDATE;
   UPDATE entitlement_grants SET revoked_at=clock_timestamp() WHERE id=p_target AND revoked_at IS NULL;
   IF NOT FOUND THEN RAISE EXCEPTION 'Entitlement is already revoked' USING ERRCODE='22023'; END IF;
   PERFORM app_private.record_org_change(grant_row.organization_id,p_action,NULL);
   result:=jsonb_build_object('success',true);
 ELSIF p_action='outbox.retry' THEN
   SELECT organization_id INTO identifier FROM outbox_events WHERE id=p_target;
   IF identifier IS NULL THEN RAISE EXCEPTION 'Unknown outbox event' USING ERRCODE='22023'; END IF;
   PERFORM 1 FROM organizations WHERE id=identifier FOR UPDATE;
   UPDATE outbox_events SET status='pending',attempts=0,lease_token=NULL,lease_until=NULL,
     last_error=NULL,next_attempt_at=clock_timestamp(),completed_at=NULL
   WHERE id=p_target AND organization_id=identifier AND status='failed';
   IF NOT FOUND THEN RAISE EXCEPTION 'Only a failed, non-retried event may be retried' USING ERRCODE='22023'; END IF;
   INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
   VALUES(gen_random_uuid()::text,identifier,actor,p_action,jsonb_build_object('eventId',p_target));
   result:=jsonb_build_object('success',true,'eventId',p_target);
 ELSIF p_action IN ('user.email_verified','user.sessions.revoke','user.2fa.unlock','user.superadmin') THEN
   SELECT * INTO target_user FROM users WHERE id=p_target FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Unknown user' USING ERRCODE='22023'; END IF;
   IF p_action='user.email_verified' THEN
     IF jsonb_typeof(p_data->'verified')<>'boolean' OR target_user.email='admin@bababuilds.com' AND p_data->>'verified'='false' THEN
       RAISE EXCEPTION 'Invalid email verification override' USING ERRCODE='22023'; END IF;
     UPDATE users SET email_verified=(p_data->>'verified')::boolean,updated_at=now() WHERE id=p_target;
     result:=jsonb_build_object('id',p_target,'email',target_user.email,'emailVerified',(p_data->>'verified')::boolean);
   ELSIF p_action='user.sessions.revoke' THEN
     DELETE FROM sessions WHERE user_id=p_target;
     GET DIAGNOSTICS affected=ROW_COUNT;
     result:=jsonb_build_object('revokedCount',affected);
   ELSIF p_action='user.2fa.unlock' THEN
     UPDATE two_factor SET failed_verification_count=0,locked_until=NULL WHERE user_id=p_target;
     GET DIAGNOSTICS affected=ROW_COUNT;
     IF affected=0 THEN RAISE EXCEPTION 'No enrolled second factor exists' USING ERRCODE='22023'; END IF;
     result:=jsonb_build_object('success',true);
   ELSE
     IF jsonb_typeof(p_data->'isSuperAdmin')<>'boolean'
       OR (p_target=actor AND p_data->>'isSuperAdmin'='false')
       OR (target_user.email='admin@bababuilds.com' AND p_data->>'isSuperAdmin'='false')
       OR (p_data->>'isSuperAdmin'='true' AND (NOT target_user.email_verified OR NOT target_user.two_factor_enabled))
     THEN RAISE EXCEPTION 'Invalid administrative elevation/revocation' USING ERRCODE='42501'; END IF;
     UPDATE users SET is_super_admin=(p_data->>'isSuperAdmin')::boolean,updated_at=now() WHERE id=p_target;
     DELETE FROM sessions WHERE user_id=p_target AND id<>NULLIF(current_setting('app.session_id',true),'');
     result:=jsonb_build_object('id',p_target,'email',target_user.email,'isSuperAdmin',(p_data->>'isSuperAdmin')::boolean);
   END IF;
 ELSIF p_action='security.ratelimit.clear' THEN
   DELETE FROM rate_limits WHERE key=p_target;
   GET DIAGNOSTICS affected=ROW_COUNT;
   IF affected=0 THEN RAISE EXCEPTION 'Unknown rate-limit key' USING ERRCODE='22023'; END IF;
   result:=jsonb_build_object('success',true,'key',p_target);
 ELSIF p_action='billing.plan.update' THEN
   IF NOT EXISTS(SELECT 1 FROM subscription_plans WHERE id=p_target)
     OR (p_data ? 'monthlyPricePaise' AND (jsonb_typeof(p_data->'monthlyPricePaise')<>'number'
       OR (p_data->>'monthlyPricePaise') !~ '^[0-9]{1,9}$'))
     OR (p_data ? 'displayName' AND (jsonb_typeof(p_data->'displayName')<>'string'
       OR length(btrim(p_data->>'displayName')) NOT BETWEEN 2 AND 100))
     OR (p_data ? 'sortOrder' AND (jsonb_typeof(p_data->'sortOrder')<>'number'
       OR (p_data->>'sortOrder') !~ '^[0-9]{1,6}$'))
     OR (p_data ? 'isActive' AND jsonb_typeof(p_data->'isActive')<>'boolean')
     OR (p_data ? 'features' AND length(p_data->>'features')>4000)
   THEN RAISE EXCEPTION 'Invalid subscription plan update' USING ERRCODE='22023'; END IF;
   IF (SELECT name FROM subscription_plans WHERE id=p_target)='kitchen_pro'
     AND p_data->>'isActive'='true' THEN
     RAISE EXCEPTION 'Kitchen Pro commercial activation is not approved' USING ERRCODE='42501'; END IF;
   UPDATE subscription_plans SET
     display_name=coalesce(p_data->>'displayName',display_name),
     monthly_price_paise=coalesce((p_data->>'monthlyPricePaise')::int,monthly_price_paise),
     features=CASE WHEN p_data ? 'features' THEN p_data->>'features' ELSE features END,
     is_active=coalesce((p_data->>'isActive')::boolean,is_active),
     sort_order=coalesce((p_data->>'sortOrder')::integer,sort_order)
   WHERE id=p_target;
   result:=jsonb_build_object('id',p_target,'success',true);
 ELSE
   RAISE EXCEPTION 'Unrecognized administrative command' USING ERRCODE='22023';
 END IF;
 INSERT INTO admin_audit_logs(id,actor_id,actor_email,action,target_type,target_id,details)
 VALUES(gen_random_uuid()::text,actor,email_address,p_action,split_part(p_action,'.',1),p_target,p_data - 'secret' - 'password');
 INSERT INTO admin_command_receipts(actor_id,request_key,action,target_id,payload,result)
 VALUES(actor,p_key,p_action,p_target,p_data,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.admin_command(text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.admin_command(text,text,jsonb,text) TO menuminute_app;
