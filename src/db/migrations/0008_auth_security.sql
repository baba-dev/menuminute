-- Native Better Auth TOTP, security audit, and one-use session-scoped step-up.
ALTER TABLE users ADD COLUMN two_factor_enabled boolean NOT NULL DEFAULT false;
ALTER TABLE organizations ADD COLUMN mfa_required boolean NOT NULL DEFAULT false;
-- Historical organizations retain false; all organizations provisioned from this release require MFA.
ALTER TABLE organizations ALTER COLUMN mfa_required SET DEFAULT true;
CREATE TABLE two_factor (
 id text PRIMARY KEY,
 user_id text NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
 secret text NOT NULL,
 backup_codes text NOT NULL,
 verified boolean NOT NULL DEFAULT false,
 failed_verification_count integer NOT NULL DEFAULT 0,
 locked_until timestamptz
);
GRANT SELECT,INSERT,UPDATE,DELETE ON two_factor TO menuminute_app;
CREATE TABLE auth_step_up (
 session_id text PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 expires_at timestamptz NOT NULL
);
CREATE TABLE auth_security_events (
 id text PRIMARY KEY,
 user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 kind text NOT NULL,
 session_id text,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX auth_security_user_idx ON auth_security_events(user_id,occurred_at DESC);
GRANT SELECT,INSERT,UPDATE,DELETE ON auth_step_up TO menuminute_app;
GRANT SELECT,INSERT ON auth_security_events TO menuminute_app;
CREATE FUNCTION app_private.require_step_up() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_session text := NULLIF(current_setting('app.session_id',true),'');
BEGIN
 IF v_session IS NULL THEN RETURN false; END IF;
 DELETE FROM auth_step_up a WHERE a.session_id=v_session
 AND a.user_id=current_setting('app.actor_id',true)
 AND a.expires_at>clock_timestamp()
 AND EXISTS (SELECT 1 FROM sessions s JOIN users u ON u.id=s.user_id
   WHERE s.id=a.session_id AND s.user_id=a.user_id AND s.expires_at>clock_timestamp()
   AND u.email_verified AND u.two_factor_enabled);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION app_private.require_step_up() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.require_step_up() TO menuminute_app;
-- Keep all existing management semantics; require a consumed recent multifactor proof
-- for owner transfer and admin elevation, including direct service invocation.
CREATE OR REPLACE FUNCTION app_private.manage_organization(p_org text,p_action text,p_data jsonb,p_key text,p_expected integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); o organizations%ROWTYPE; caller organization_members%ROWTYPE; target organization_members%ROWTYPE; r restaurants%ROWTYPE; old_result jsonb; old_command jsonb; command jsonb; result jsonb:='{}'; uid text; mid text; rid text; bid text; mode_list text[]; requested_roles text[]; is_admin boolean; v integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=p_org AND m.user_id=actor AND m.is_active) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM organizations WHERE id=p_org FOR UPDATE;
 SELECT * INTO caller FROM organization_members m WHERE m.organization_id=p_org AND m.user_id=actor AND m.is_active;
 IF caller.id IS NULL OR NOT o.is_active AND NOT (caller.role='owner' AND p_action='organization.active') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 is_admin:=caller.role IN ('owner','admin');
 IF is_admin AND o.mfa_required AND NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND two_factor_enabled AND email_verified) THEN RAISE EXCEPTION 'Enroll two-factor authentication' USING ERRCODE='42501'; END IF;
 IF (p_action='owner.transfer' OR (p_action='member.save' AND p_data->>'role'='admin')) AND NOT app_private.require_step_up() THEN RAISE EXCEPTION 'Recent multifactor confirmation required' USING ERRCODE='42501'; END IF;
 IF p_action IN ('organization.active','owner.transfer') AND caller.role<>'owner' THEN RAISE EXCEPTION 'Owner required' USING ERRCODE='42501'; END IF;
 IF p_action NOT IN ('outlet.update','outlet.roles') AND NOT is_admin THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF p_action IN ('outlet.update','outlet.roles') THEN
  SELECT * INTO r FROM restaurants WHERE id=p_data->>'outletId' AND organization_id=p_org;
  IF r.id IS NULL OR NOT is_admin AND NOT app_private.can_outlet(r.id,'outlet.manage') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 END IF;
 IF length(p_key)>128 OR length(p_key)<16 THEN RAISE EXCEPTION 'Invalid key' USING ERRCODE='22023'; END IF;
 command:=jsonb_build_object('action',p_action,'data',p_data,'expectedVersion',p_expected);
 SELECT c.command,c.result INTO old_command,old_result FROM domain_commands c WHERE c.organization_id=p_org AND c.actor_id=actor AND c.request_key=p_key;
 IF FOUND THEN IF old_command<>command THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF; RETURN old_result; END IF;
 IF o.version<>p_expected THEN RAISE EXCEPTION 'Stale organization version' USING ERRCODE='40001'; END IF;
 CASE p_action
 WHEN 'organization.rename' THEN
  IF length(p_data->>'name') NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Invalid name' USING ERRCODE='22023'; END IF;
  UPDATE organizations SET name=p_data->>'name' WHERE id=p_org;
 WHEN 'organization.active' THEN UPDATE organizations SET is_active=(p_data->>'isActive')::boolean WHERE id=p_org;
 WHEN 'owner.transfer' THEN
  SELECT * INTO target FROM organization_members WHERE id=p_data->>'memberId' AND organization_id=p_org AND is_active;
  IF target.id IS NULL OR target.id=caller.id THEN RAISE EXCEPTION 'Invalid new owner' USING ERRCODE='22023'; END IF;
  UPDATE organization_members SET role='member' WHERE id=caller.id;
  UPDATE organization_members SET role='owner' WHERE id=target.id;
 WHEN 'member.save' THEN
  IF p_data->>'role' NOT IN ('member','admin') THEN RAISE EXCEPTION 'Invalid role' USING ERRCODE='22023'; END IF;
  SELECT id INTO uid FROM users WHERE email=lower(p_data->>'email');
  IF uid IS NULL THEN RAISE EXCEPTION 'Existing account required' USING ERRCODE='22023'; END IF;
  SELECT * INTO target FROM organization_members WHERE organization_id=p_org AND user_id=uid;
  IF target.role='owner' THEN RAISE EXCEPTION 'Owner is protected' USING ERRCODE='42501'; END IF;
  mid:=COALESCE(target.id,gen_random_uuid()::text);
  INSERT INTO organization_members(id,organization_id,user_id,role,is_active) VALUES(mid,p_org,uid,p_data->>'role',(p_data->>'isActive')::boolean)
  ON CONFLICT(organization_id,user_id) DO UPDATE SET role=EXCLUDED.role,is_active=EXCLUDED.is_active;
  result:=jsonb_build_object('memberId',mid);
 WHEN 'outlet.create' THEN
  rid:=gen_random_uuid()::text;
  SELECT array_agg(value) INTO mode_list FROM jsonb_array_elements_text(p_data->'fulfillmentModes');
  INSERT INTO restaurants(id,organization_id,public_id,name,slug,country,currency,timezone,outlet_type,fulfillment_modes) VALUES(rid,p_org,gen_random_uuid()::text,p_data->>'name',rid,p_data->>'country',p_data->>'currency',p_data->>'timezone',p_data->>'outletType',mode_list);
  INSERT INTO qr_codes(id,restaurant_id,destination_token,label) SELECT gen_random_uuid()::text,rid,public_id,'Main Menu QR' FROM restaurants WHERE id=rid;
  result:=jsonb_build_object('outletId',rid);
 WHEN 'outlet.update' THEN
  IF p_data?'currency' AND p_data->>'currency'<>r.currency AND (EXISTS(SELECT 1 FROM menu_items WHERE restaurant_id=r.id) OR EXISTS(SELECT 1 FROM orders WHERE restaurant_id=r.id)) THEN RAISE EXCEPTION 'Explicit repricing required' USING ERRCODE='22023'; END IF;
  SELECT array_agg(value) INTO mode_list FROM jsonb_array_elements_text(COALESCE(p_data->'fulfillmentModes',to_jsonb(r.fulfillment_modes)));
  UPDATE restaurants SET name=COALESCE(p_data->>'name',name),country=COALESCE(p_data->>'country',country),currency=COALESCE(p_data->>'currency',currency),timezone=COALESCE(p_data->>'timezone',timezone),outlet_type=COALESCE(p_data->>'outletType',outlet_type),fulfillment_modes=mode_list,updated_at=now() WHERE id=r.id;
  rid:=r.id;
 WHEN 'outlet.roles' THEN
  SELECT * INTO target FROM organization_members WHERE id=p_data->>'memberId' AND organization_id=p_org AND is_active;
  IF target.id IS NULL OR target.role<>'member' THEN RAISE EXCEPTION 'Scoped member required' USING ERRCODE='22023'; END IF;
  SELECT COALESCE(array_agg(value),ARRAY[]::text[]) INTO requested_roles FROM jsonb_array_elements_text(p_data->'roles');
  IF NOT requested_roles <@ ARRAY['manager','service','kitchen','menu_editor']::text[] THEN RAISE EXCEPTION 'Invalid scoped roles' USING ERRCODE='22023'; END IF;
  DELETE FROM outlet_grants WHERE organization_id=p_org AND member_id=target.id AND outlet_id=r.id;
  IF cardinality(requested_roles)>0 THEN INSERT INTO outlet_grants(organization_id,member_id,outlet_id,roles) VALUES(p_org,target.id,r.id,requested_roles); END IF;
  rid:=r.id;
 WHEN 'brand.create' THEN
  bid:=gen_random_uuid()::text;INSERT INTO brands(id,organization_id,name) VALUES(bid,p_org,p_data->>'name');result:=jsonb_build_object('brandId',bid);
 WHEN 'brand.link' THEN
  IF NOT EXISTS(SELECT 1 FROM brands WHERE id=p_data->>'brandId' AND organization_id=p_org) OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_data->>'outletId' AND organization_id=p_org) THEN RAISE EXCEPTION 'Invalid assignment' USING ERRCODE='22023'; END IF;
  rid:=p_data->>'outletId';
  IF (p_data->>'linked')::boolean THEN INSERT INTO brand_outlets(organization_id,brand_id,outlet_id) VALUES(p_org,p_data->>'brandId',rid) ON CONFLICT DO NOTHING; ELSE DELETE FROM brand_outlets WHERE organization_id=p_org AND brand_id=p_data->>'brandId' AND outlet_id=rid; END IF;
 ELSE RAISE EXCEPTION 'Unknown action' USING ERRCODE='22023'; END CASE;
 v:=app_private.record_org_change(p_org,p_action,rid);
 -- Preserve immutable command audit context without session secrets or personal customer data.
 UPDATE domain_audit SET details=details||jsonb_build_object('requestKey',p_key,'targetMemberId',p_data->>'memberId') WHERE organization_id=p_org AND details->>'version'=v::text;
 result:=result||jsonb_build_object('version',v);
 INSERT INTO domain_commands(id,organization_id,actor_id,request_key,command,result) VALUES(gen_random_uuid()::text,p_org,actor,p_key,command,result);
 RETURN result;
END $$;

REVOKE ALL ON FUNCTION app_private.manage_organization(text,text,jsonb,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.manage_organization(text,text,jsonb,text,integer) TO menuminute_app;
