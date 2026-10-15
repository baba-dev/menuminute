-- Additive Phase 2 policies. Existing applied migrations remain immutable.
UPDATE restaurants SET fulfillment_modes=ARRAY['pickup']::text[] WHERE outlet_type IN ('cafe','takeout','cloud_kitchen');
ALTER TABLE restaurants ADD CONSTRAINT fulfillment_valid CHECK(cardinality(fulfillment_modes)>0 AND fulfillment_modes <@ ARRAY['dine_in','pickup']::text[]);
CREATE UNIQUE INDEX one_active_org_owner ON organization_members(organization_id) WHERE role='owner' AND is_active;
ALTER TABLE outbox_events ADD CONSTRAINT outbox_status_valid CHECK(status IN ('pending','dispatched','completed','failed'));
ALTER TABLE outbox_events ADD CONSTRAINT outbox_attempts_valid CHECK(attempts>=0 AND max_attempts BETWEEN 1 AND 100);
ALTER TABLE entitlement_grants ADD CONSTRAINT entitlement_valid CHECK(capability IN ('ordering.new','kitchen.new') AND billing_currency IN ('USD','INR') AND ends_at>starts_at);

CREATE FUNCTION app_private.org_admin(p_org text,p_owner_only boolean DEFAULT false,p_include_inactive boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id WHERE m.organization_id=p_org AND m.user_id=current_setting('app.actor_id',true) AND m.is_active AND (o.is_active OR p_include_inactive AND m.role='owner') AND (m.role='owner' OR NOT p_owner_only AND m.role='admin'))
$$;
REVOKE ALL ON FUNCTION app_private.org_admin(text,boolean,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.org_admin(text,boolean,boolean) TO menuminute_app;
CREATE POLICY owner_suspended_org_read ON organizations FOR SELECT USING(app_private.org_admin(id,true,true));
-- All new administrative writes go through checked commands, never broad direct table UPDATE grants.
REVOKE UPDATE ON restaurants FROM menuminute_app;

DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['domain_audit','domain_commands','outbox_events','consumer_receipts','domain_projections','entitlement_grants'] LOOP EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t); END LOOP;
END $$;
CREATE POLICY audit_admin_read ON domain_audit FOR SELECT USING(app_private.org_admin(organization_id,false,true));
CREATE POLICY jobs_admin_read ON outbox_events FOR SELECT USING(app_private.org_admin(organization_id,false,true));
CREATE POLICY projections_admin_read ON domain_projections FOR SELECT USING(app_private.org_admin(organization_id,false,true));
CREATE POLICY billing_owner_read ON entitlement_grants FOR SELECT USING(app_private.org_admin(organization_id,true,true));
GRANT SELECT ON domain_audit,outbox_events,domain_projections,entitlement_grants TO menuminute_app;

CREATE FUNCTION app_private.record_org_change(p_org text,p_action text,p_outlet text DEFAULT NULL) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v integer; snap jsonb;
BEGIN
 UPDATE organizations SET version=version+1 WHERE id=p_org RETURNING version INTO v;
 IF v IS NULL THEN RAISE EXCEPTION 'Unknown organization' USING ERRCODE='22023'; END IF;
 -- Operational backpressure for non-security expansion, not a commercial quota. Revocation remains possible.
 IF p_action IN ('outlet.create','brand.create') AND (SELECT count(*) FROM outbox_events e WHERE e.organization_id=p_org AND e.status IN ('pending','dispatched'))>=1000 THEN RAISE EXCEPTION 'Background backlog' USING ERRCODE='53000'; END IF;
 SELECT jsonb_build_object('organizationId',o.id,'name',o.name,'active',o.is_active,'version',v,'outletCount',(SELECT count(*) FROM restaurants r WHERE r.organization_id=o.id),'memberCount',(SELECT count(*) FROM organization_members m WHERE m.organization_id=o.id AND m.is_active)) INTO snap FROM organizations o WHERE o.id=p_org;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(gen_random_uuid()::text,p_org,NULLIF(current_setting('app.actor_id',true),''),p_action,jsonb_build_object('version',v,'outletId',p_outlet));
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload) VALUES(gen_random_uuid()::text,p_org,p_outlet,'organization.changed',1,v,snap);
 RETURN v;
END $$;
REVOKE ALL ON FUNCTION app_private.record_org_change(text,text,text) FROM PUBLIC;

CREATE FUNCTION app_private.manage_organization(p_org text,p_action text,p_data jsonb,p_key text,p_expected integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); o organizations%ROWTYPE; caller organization_members%ROWTYPE; target organization_members%ROWTYPE; r restaurants%ROWTYPE; old_result jsonb; old_command jsonb; command jsonb; result jsonb:='{}'; uid text; mid text; rid text; bid text; mode_list text[]; requested_roles text[]; is_admin boolean; v integer;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM organization_members m WHERE m.organization_id=p_org AND m.user_id=actor AND m.is_active) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO o FROM organizations WHERE id=p_org FOR UPDATE;
 SELECT * INTO caller FROM organization_members m WHERE m.organization_id=p_org AND m.user_id=actor AND m.is_active;
 IF caller.id IS NULL OR NOT o.is_active AND NOT (caller.role='owner' AND p_action='organization.active') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 is_admin:=caller.role IN ('owner','admin');
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

-- Worker is an isolated role, not migration owner and never the web credential.
GRANT USAGE ON SCHEMA public TO menuminute_worker;
GRANT SELECT,UPDATE ON outbox_events TO menuminute_worker;
GRANT SELECT,INSERT ON consumer_receipts TO menuminute_worker;
GRANT SELECT,INSERT,UPDATE ON domain_projections TO menuminute_worker;
CREATE POLICY worker_events ON outbox_events TO menuminute_worker USING(true) WITH CHECK(true);
CREATE POLICY worker_receipts ON consumer_receipts TO menuminute_worker USING(true) WITH CHECK(true);
CREATE POLICY worker_projections ON domain_projections TO menuminute_worker USING(true) WITH CHECK(true);

CREATE FUNCTION app_private.entitlement_allowed(p_org text,p_capability text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_private.is_org_member(p_org) AND EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.organization_id=p_org AND g.capability=p_capability AND g.revoked_at IS NULL AND g.starts_at<=statement_timestamp() AND g.ends_at>statement_timestamp())
$$;
REVOKE ALL ON FUNCTION app_private.entitlement_allowed(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.entitlement_allowed(text,text) TO menuminute_app;

CREATE OR REPLACE FUNCTION app_private.provision_organization(outlet text,token text,request_input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=current_setting('app.actor_id',true); org text:='org-'||outlet;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=actor) THEN RAISE EXCEPTION 'Unknown actor'; END IF;
 IF length(token)<12 OR length(request_input->>'name') NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Invalid provisioning input'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(outlet,0));
 IF EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id=outlet) THEN
  IF NOT EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id=outlet AND p.actor_id=actor AND p.input=(request_input-'svgData')) THEN RAISE EXCEPTION 'Provisioning key conflict'; END IF;
  RETURN;
 END IF;
 INSERT INTO organizations(id,name) VALUES(org,request_input->>'name');
 INSERT INTO organization_members(id,organization_id,user_id,role) VALUES('member-'||outlet,org,actor,'owner');
 INSERT INTO restaurants(id,organization_id,public_id,name,slug,description,city,country,currency,timezone,outlet_type)
 VALUES(outlet,org,token,request_input->>'name',outlet,request_input->>'description',request_input->>'city',request_input->>'country',request_input->>'currency',request_input->>'timezone',request_input->>'outletType');
 INSERT INTO app_private.provisioning_requests(outlet_id,actor_id,input) VALUES(outlet,actor,request_input-'svgData');
 INSERT INTO brands(id,organization_id,name) VALUES('brand-'||outlet,org,request_input->>'name');
 INSERT INTO brand_outlets(organization_id,brand_id,outlet_id) VALUES(org,'brand-'||outlet,outlet);
 INSERT INTO qr_codes(id,restaurant_id,destination_token,svg_data,label) VALUES('qr-'||outlet,outlet,token,request_input->>'svgData','Main Menu QR');
 UPDATE restaurants SET fulfillment_modes=ARRAY['pickup']::text[] WHERE id=outlet AND outlet_type IN ('cafe','takeout','cloud_kitchen');
 PERFORM app_private.record_org_change(org,'organization.created',outlet);
END $$;
REVOKE ALL ON FUNCTION app_private.provision_organization(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.provision_organization(text,text,jsonb) TO menuminute_app;


-- Receipt scope must agree with its durable producer, even for a compromised queue payload.
ALTER TABLE outbox_events ADD CONSTRAINT event_org_unique UNIQUE(organization_id,id);
ALTER TABLE consumer_receipts ADD CONSTRAINT receipt_event_scope FOREIGN KEY(organization_id,event_id) REFERENCES outbox_events(organization_id,id);
CREATE FUNCTION app_private.require_entitlement(p_org text,p_capability text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.is_org_member(p_org) THEN RETURN false; END IF;
 PERFORM 1 FROM organizations WHERE id=p_org FOR SHARE;
 RETURN app_private.is_org_member(p_org) AND EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.organization_id=p_org AND g.capability=p_capability AND g.revoked_at IS NULL AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp());
END $$;
REVOKE ALL ON FUNCTION app_private.require_entitlement(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.require_entitlement(text,text) TO menuminute_app;
CREATE FUNCTION app_private.retry_event(p_org text,p_event text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.org_admin(p_org) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM organizations WHERE id=p_org FOR UPDATE;
 IF NOT app_private.org_admin(p_org) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE outbox_events SET status='pending',attempts=0,lease_token=NULL,lease_until=NULL,next_attempt_at=now(),last_error=NULL WHERE id=p_event AND organization_id=p_org AND status='failed';
 IF NOT FOUND THEN RAISE EXCEPTION 'Failed event required' USING ERRCODE='22023'; END IF;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details) VALUES(gen_random_uuid()::text,p_org,current_setting('app.actor_id',true),'job.retry',jsonb_build_object('eventId',p_event));
END $$;
REVOKE ALL ON FUNCTION app_private.retry_event(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.retry_event(text,text) TO menuminute_app;
CREATE POLICY suspended_owner_member ON organization_members FOR SELECT USING(user_id=current_setting('app.actor_id',true) AND app_private.org_admin(organization_id,true,true));

ALTER TABLE outbox_events ADD COLUMN delivery_sequence integer NOT NULL DEFAULT 0;
ALTER TABLE outbox_events ADD CONSTRAINT delivery_sequence_valid CHECK(delivery_sequence>=0);
CREATE FUNCTION app_private.lock_outlet(p_outlet text,p_permission text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org text;
BEGIN
 IF NOT app_private.can_outlet(p_outlet,p_permission) THEN RETURN false; END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
 PERFORM 1 FROM organizations WHERE id=org FOR SHARE;
 RETURN app_private.can_outlet(p_outlet,p_permission);
END $$;
REVOKE ALL ON FUNCTION app_private.lock_outlet(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.lock_outlet(text,text) TO menuminute_app;
CREATE FUNCTION app_private.scoped_member_directory(p_org text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM restaurants r WHERE r.organization_id=p_org AND app_private.can_outlet(r.id,'outlet.manage')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'name',u.name,'email','','role',m.role,'isActive',m.is_active)) FROM organization_members m JOIN users u ON u.id=m.user_id WHERE m.organization_id=p_org AND m.is_active AND m.role='member'),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.scoped_member_directory(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.scoped_member_directory(text) TO menuminute_app;
