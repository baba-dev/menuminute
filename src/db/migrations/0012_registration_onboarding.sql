-- Registration and onboarding 2.0: additive, independent of legacy membership backfill.
CREATE TABLE onboarding_progress (
 user_id text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 operation_key text NOT NULL,
 draft jsonb NOT NULL DEFAULT '{}'::jsonb,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','provisioning','completed')),
 outlet_id text,
 updated_at timestamptz NOT NULL DEFAULT now(),
 CHECK (length(operation_key)=36),
 CHECK (jsonb_typeof(draft)='object')
);
ALTER TABLE onboarding_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE onboarding_progress FORCE ROW LEVEL SECURITY;
CREATE POLICY self_onboarding ON onboarding_progress USING (user_id=current_setting('app.actor_id',true)) WITH CHECK (user_id=current_setting('app.actor_id',true));
GRANT SELECT,INSERT,UPDATE ON onboarding_progress TO menuminute_app;
CREATE TABLE organization_invitations (
 id text PRIMARY KEY,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 email text NOT NULL,
 role text NOT NULL CHECK(role IN ('member','admin')),
 inviter_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 request_key text NOT NULL,
 token_hash text NOT NULL UNIQUE,
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','accepted','revoked')),
 expires_at timestamptz NOT NULL,
 accepted_by text REFERENCES users(id),
 accepted_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(organization_id,inviter_id,request_key),
 CHECK (email=lower(email) AND length(email)<=254),
 CHECK (token_hash ~ '^[0-9a-f]{64}$')
);
CREATE INDEX invitations_pending_org ON organization_invitations(organization_id,expires_at) WHERE status='pending';
CREATE INDEX invitations_matching_email ON organization_invitations(email,expires_at) WHERE status='pending';
-- No direct application-role table access. Every invite transition passes a narrow SECURITY DEFINER function.
REVOKE ALL ON organization_invitations FROM PUBLIC,menuminute_app;
CREATE FUNCTION app_private.issue_invitation(p_org text,p_email text,p_role text,p_key text,p_hash text)
 RETURNS TABLE(invite_id text,expires_at timestamptz)
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); old organization_invitations%ROWTYPE;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND email_verified) OR p_role NOT IN ('member','admin')
  OR p_email<>lower(p_email) OR length(p_email)>254 OR length(p_hash)<>64 OR length(p_key)<>36
 THEN RAISE EXCEPTION 'Invalid invitation' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM organizations WHERE id=p_org AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT app_private.org_admin(p_org) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO old FROM organization_invitations WHERE organization_id=p_org AND inviter_id=actor AND request_key=p_key;
 IF FOUND THEN
  IF old.email<>p_email OR old.role<>p_role OR old.token_hash<>p_hash OR old.status<>'pending' OR old.expires_at<=now() THEN
   RAISE EXCEPTION 'Invitation key conflict' USING ERRCODE='40001'; END IF;
  RETURN QUERY SELECT old.id,old.expires_at; RETURN;
 END IF;
 IF p_role='admin' AND NOT app_private.require_step_up() THEN RAISE EXCEPTION 'Recent MFA required' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM organization_members WHERE organization_id=p_org AND is_active)>=10 OR
  (SELECT count(*) FROM organization_invitations i WHERE i.organization_id=p_org AND i.status='pending' AND i.expires_at>now())>=10
 THEN RAISE EXCEPTION 'Invitation capacity reached' USING ERRCODE='P3002'; END IF;
 IF EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id
   WHERE m.organization_id=p_org AND u.email=p_email AND m.is_active) THEN
   RAISE EXCEPTION 'Already a member' USING ERRCODE='23505'; END IF;
 RETURN QUERY INSERT INTO organization_invitations(id,organization_id,email,role,inviter_id,request_key,token_hash,expires_at)
 VALUES(gen_random_uuid()::text,p_org,p_email,p_role,actor,p_key,p_hash,now()+interval '7 days')
 RETURNING organization_invitations.id,organization_invitations.expires_at;
END $$;
REVOKE ALL ON FUNCTION app_private.issue_invitation(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.issue_invitation(text,text,text,text,text) TO menuminute_app;
CREATE FUNCTION app_private.invitation_preview(p_hash text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); result jsonb;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND email_verified) THEN RAISE EXCEPTION 'Verified login required' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object('organization',o.name,'email',i.email,'role',i.role,'expiresAt',i.expires_at,'status',i.status)
 INTO result FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id
 JOIN users u ON u.id=actor WHERE i.token_hash=p_hash AND i.email=lower(u.email) AND i.expires_at>now() AND o.is_active;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.invitation_preview(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.invitation_preview(text) TO menuminute_app;
CREATE FUNCTION app_private.accept_invitation(p_hash text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); inv organization_invitations%ROWTYPE; v_email text; mid text;
BEGIN
 SELECT u.email INTO v_email FROM users u WHERE u.id=actor AND u.email_verified FOR UPDATE;
 IF v_email IS NULL THEN RAISE EXCEPTION 'Verified login required' USING ERRCODE='42501'; END IF;
 SELECT * INTO inv FROM organization_invitations WHERE token_hash=p_hash FOR UPDATE;
 IF inv.id IS NULL OR inv.email<>lower(v_email) OR inv.status<>'pending' OR inv.expires_at<=now()
 THEN RAISE EXCEPTION 'Invalid or expired invitation' USING ERRCODE='22023'; END IF;
 PERFORM 1 FROM organizations WHERE id=inv.organization_id AND is_active FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
 IF inv.role='admin' AND NOT EXISTS(SELECT 1 FROM users WHERE id=actor AND two_factor_enabled)
 THEN RAISE EXCEPTION 'Enroll MFA before accepting admin invitation' USING ERRCODE='42501'; END IF;
 IF (SELECT count(*) FROM organization_members WHERE organization_id=inv.organization_id AND is_active)>=10
 THEN RAISE EXCEPTION 'Member capacity reached' USING ERRCODE='P3002'; END IF;
 SELECT id INTO mid FROM organization_members WHERE organization_id=inv.organization_id AND user_id=actor FOR UPDATE;
 IF mid IS NOT NULL AND EXISTS(SELECT 1 FROM organization_members WHERE id=mid AND (is_active OR role='owner'))
 THEN RAISE EXCEPTION 'Existing active membership requires administrator review' USING ERRCODE='23505'; END IF;
 IF mid IS NULL THEN
  mid:=gen_random_uuid()::text;
  INSERT INTO organization_members(id,organization_id,user_id,role,is_active)
  VALUES(mid,inv.organization_id,actor,inv.role,true);
 ELSE
  UPDATE organization_members SET role=inv.role,is_active=true WHERE id=mid;
 END IF;
 UPDATE organization_invitations SET status='accepted',accepted_by=actor,accepted_at=now() WHERE id=inv.id;
 RETURN jsonb_build_object('organizationId',inv.organization_id,'memberId',mid);
END $$;
REVOKE ALL ON FUNCTION app_private.accept_invitation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.accept_invitation(text) TO menuminute_app;
CREATE FUNCTION app_private.revoke_invitation(p_org text,p_id text) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM organizations WHERE id=p_org AND is_active FOR UPDATE;
 IF NOT FOUND OR NOT app_private.org_admin(p_org) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE organization_invitations SET status='revoked'
 WHERE id=p_id AND organization_id=p_org AND status='pending';
 IF NOT FOUND THEN RAISE EXCEPTION 'Pending invitation required' USING ERRCODE='22023'; END IF;
END $$;
REVOKE ALL ON FUNCTION app_private.revoke_invitation(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.revoke_invitation(text,text) TO menuminute_app;
CREATE FUNCTION app_private.list_invitations(p_org text) RETURNS jsonb
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.org_admin(p_org) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',id,'email',email,'role',role,'status',status,'expiresAt',expires_at)
 ORDER BY created_at DESC) FROM organization_invitations WHERE organization_id=p_org),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.list_invitations(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.list_invitations(text) TO menuminute_app;
-- Never permit direct membership assignment to create or reactivate a user. New
-- memberships must come through a verified, email-bound invitation acceptance.
CREATE FUNCTION app_private.guard_membership_invitation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF TG_OP='UPDATE' AND OLD.is_active=false AND NEW.is_active=true
  AND NOT EXISTS(SELECT 1 FROM organization_invitations i JOIN users u ON u.email=i.email
    WHERE i.organization_id=NEW.organization_id AND u.id=NEW.user_id
    AND i.status='pending' AND i.expires_at>now())
 THEN RAISE EXCEPTION 'Invitation acceptance required' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.guard_membership_invitation() FROM PUBLIC;
CREATE TRIGGER member_reactivation_requires_invitation BEFORE UPDATE OF is_active ON organization_members
 FOR EACH ROW EXECUTE FUNCTION app_private.guard_membership_invitation();
-- Enforce a finite free-account provisioning budget in the trusted transactional function.
CREATE OR REPLACE FUNCTION app_private.provision_organization(outlet text,token text,request_input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=current_setting('app.actor_id',true); org text:='org-'||outlet;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=actor) THEN RAISE EXCEPTION 'Unknown actor'; END IF;
 IF length(token)<12 OR length(request_input->>'name') NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Invalid provisioning input'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(outlet,0));
 -- Serialize new-organization creation per verified identity, not just per request key.
 PERFORM 1 FROM users WHERE id=actor AND email_verified FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Verified account required' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id=outlet) THEN
  IF NOT EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id=outlet AND p.actor_id=actor AND p.input=(request_input-'svgData')) THEN RAISE EXCEPTION 'Provisioning key conflict'; END IF;
  RETURN;
 END IF;
 IF (SELECT count(*) FROM organization_members WHERE user_id=actor AND role='owner' AND is_active)>=3 THEN
  RAISE EXCEPTION 'New account organization limit reached' USING ERRCODE='P3001';
 END IF;
 INSERT INTO organizations(id,name) VALUES(org,request_input->>'name');
 INSERT INTO organization_members(id,organization_id,user_id,role) VALUES('member-'||outlet,org,actor,'owner');
 INSERT INTO restaurants(id,organization_id,public_id,name,slug,description,city,country,currency,timezone,outlet_type,fulfillment_modes)
 VALUES(outlet,org,token,request_input->>'name',outlet,request_input->>'description',request_input->>'city',request_input->>'country',request_input->>'currency',request_input->>'timezone',request_input->>'outletType',CASE WHEN request_input->>'outletType' IN ('cafe','takeout','cloud_kitchen') THEN ARRAY['pickup']::text[] ELSE ARRAY['dine_in']::text[] END);
 INSERT INTO app_private.provisioning_requests(outlet_id,actor_id,input) VALUES(outlet,actor,request_input-'svgData');
 INSERT INTO brands(id,organization_id,name) VALUES('brand-'||outlet,org,request_input->>'name');
 INSERT INTO brand_outlets(organization_id,brand_id,outlet_id) VALUES(org,'brand-'||outlet,outlet);
 INSERT INTO qr_codes(id,restaurant_id,destination_token,svg_data,label) VALUES('qr-'||outlet,outlet,token,request_input->>'svgData','Main Menu QR');
 UPDATE restaurants SET fulfillment_modes=ARRAY['pickup']::text[] WHERE id=outlet AND outlet_type IN ('cafe','takeout','cloud_kitchen');
 PERFORM app_private.record_org_change(org,'organization.created',outlet);
END $$;


-- Legacy organization management may edit or deactivate existing members, but cannot add
-- new accounts or reactivate dormant accounts without an accepted invitation.
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
  IF target.id IS NULL OR ((p_data->>'isActive')::boolean AND NOT target.is_active) THEN
   RAISE EXCEPTION 'Invitation acceptance required for new or returning members' USING ERRCODE='42501';
  END IF;
  mid:=target.id;
  UPDATE organization_members SET role=p_data->>'role',is_active=(p_data->>'isActive')::boolean WHERE id=mid;
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

