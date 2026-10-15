-- Phase 3: immutable releases, explicit assignments and private media lifecycle.
ALTER TABLE brand_outlets ADD CONSTRAINT brand_link_scope_unique UNIQUE(organization_id,brand_id,outlet_id);
ALTER TABLE menu_assignments ADD CONSTRAINT assignment_brand_scope FOREIGN KEY(organization_id,brand_id,outlet_id) REFERENCES brand_outlets(organization_id,brand_id,outlet_id);
ALTER TABLE menu_overrides ADD CONSTRAINT override_assignment FOREIGN KEY(menu_id,outlet_id) REFERENCES menu_assignments(menu_id,outlet_id);
ALTER TABLE menu_overrides ADD CONSTRAINT override_price_valid CHECK(price_minor>=0);
ALTER TABLE dish_media ADD CONSTRAINT media_state_valid CHECK(status IN ('uploading','queued','ready','failed'));
ALTER TABLE dish_media ADD CONSTRAINT media_size_valid CHECK(size_bytes BETWEEN 1 AND 5242880);
CREATE FUNCTION app_private.menu_access(p_menu text,p_permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM menus m WHERE m.id=p_menu AND app_private.can_outlet(m.outlet_id,p_permission) AND (p_permission='menu.read' OR NOT EXISTS(SELECT 1 FROM menu_assignments a WHERE a.menu_id=m.id AND NOT app_private.can_outlet(a.outlet_id,p_permission))))
 OR p_permission='menu.read' AND EXISTS(SELECT 1 FROM menu_assignments a WHERE a.menu_id=p_menu AND app_private.can_outlet(a.outlet_id,p_permission))
$$;
REVOKE ALL ON FUNCTION app_private.menu_access(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.menu_access(text,text) TO menuminute_app;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['menus','menu_releases','menu_assignments','menu_overrides'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY menu_read ON %I FOR SELECT TO menuminute_app USING(app_private.menu_access(%I,%L))',t,CASE WHEN t='menus' THEN 'id' ELSE 'menu_id' END,'menu.read');
 END LOOP;
END $$;
ALTER TABLE dish_media ENABLE ROW LEVEL SECURITY;
CREATE POLICY media_read ON dish_media FOR SELECT TO menuminute_app USING(app_private.can_outlet(outlet_id,'menu.write'));
GRANT SELECT ON menus,menu_releases,menu_assignments,menu_overrides,dish_media TO menuminute_app;
CREATE FUNCTION app_private.menu_command(p_outlet text,p_menu text,p_action text,p_data jsonb,p_key text,p_expected integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; m menus%ROWTYPE; prev domain_commands%ROWTYPE; cmd jsonb; result jsonb; v integer; doc jsonb; target restaurants%ROWTYPE; actor text:=current_setting('app.actor_id',true);
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 PERFORM 1 FROM organizations WHERE id=r.organization_id FOR UPDATE;
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 SELECT * INTO m FROM menus WHERE id=p_menu AND organization_id=r.organization_id;
 IF p_action<>'create' AND (m.id IS NULL OR (p_action<>'override' AND NOT app_private.menu_access(p_menu,'menu.write')) OR (p_action='override' AND (p_data->>'outletId'<>p_outlet OR NOT EXISTS(SELECT 1 FROM menu_assignments WHERE menu_id=p_menu AND outlet_id=p_outlet)))) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 cmd:=jsonb_build_object('menuId',p_menu,'outletId',p_outlet,'action',p_action,'data',p_data,'expectedRevision',p_expected);
 SELECT * INTO prev FROM domain_commands WHERE organization_id=r.organization_id AND actor_id=actor AND request_key=p_key;
 IF FOUND THEN IF prev.command<>cmd AND NOT (p_action='create' AND prev.command->>'action'='create' AND prev.command->>'menuId'=p_menu AND prev.command->>'outletId'=p_outlet) THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;RETURN prev.result;END IF;
 IF p_action='create' THEN
 IF m.id IS NOT NULL OR p_expected<>0 THEN RAISE EXCEPTION 'Menu exists' USING ERRCODE='40001'; END IF;
 ELSE IF m.revision<>p_expected THEN RAISE EXCEPTION 'Stale menu' USING ERRCODE='40001'; END IF; END IF;
 doc:=CASE WHEN p_action IN ('create','save') THEN p_data->'document' ELSE m.document END;
 IF p_action IN ('create','save') THEN
 IF octet_length(doc::text)>600000 OR doc->>'currency'<>r.currency OR jsonb_typeof(doc->'categories')<>'array' THEN RAISE EXCEPTION 'Invalid menu' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM menu_assignments a JOIN restaurants x ON x.id=a.outlet_id WHERE a.menu_id=p_menu AND x.currency<>doc->>'currency') THEN RAISE EXCEPTION 'Currency mismatch' USING ERRCODE='22023';END IF;
 END IF;
 CASE p_action
 WHEN 'create' THEN
 INSERT INTO menus(id,organization_id,outlet_id,document) VALUES(p_menu,r.organization_id,r.id,doc);
 INSERT INTO menu_assignments(organization_id,menu_id,outlet_id) VALUES(r.organization_id,p_menu,r.id);
 v:=1;
 WHEN 'save' THEN
 IF m.archived THEN RAISE EXCEPTION 'Restore archived menu first' USING ERRCODE='22023';END IF;
 UPDATE menus SET document=doc,revision=revision+1,updated_at=now() WHERE id=p_menu RETURNING revision INTO v;
 WHEN 'publish' THEN
 IF m.archived OR NOT EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'categories') c,jsonb_array_elements(c->'items') i WHERE NOT (c->>'archived')::boolean AND NOT (i->>'archived')::boolean) THEN RAISE EXCEPTION 'Active dish required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'categories') c,jsonb_array_elements(c->'items') i WHERE i->>'mediaId' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM dish_media a WHERE a.id=i->>'mediaId' AND a.organization_id=r.organization_id AND a.status='ready' AND a.approved_at IS NOT NULL AND app_private.can_outlet(a.outlet_id,'menu.write'))) THEN RAISE EXCEPTION 'Approved scoped media required' USING ERRCODE='22023';END IF;
 IF EXISTS(SELECT 1 FROM menu_assignments a JOIN restaurants x ON x.id=a.outlet_id WHERE a.menu_id=p_menu AND x.currency<>doc->>'currency') THEN RAISE EXCEPTION 'Currency mismatch' USING ERRCODE='22023';END IF;
 v:=m.revision+1;
 INSERT INTO menu_releases(menu_id,revision,organization_id,document,published_by) VALUES(p_menu,v,r.organization_id,doc,actor);
 UPDATE menus SET revision=v,published_revision=v,updated_at=now() WHERE id=p_menu;
 UPDATE restaurants SET is_published=true,free_menu_enabled=true WHERE id IN (SELECT outlet_id FROM menu_assignments WHERE menu_id=p_menu);
 WHEN 'unpublish','archive','restore' THEN
 v:=m.revision+1;
 UPDATE menus SET revision=v,published_revision=CASE WHEN p_action='restore' THEN published_revision ELSE NULL END,archived=p_action='archive',updated_at=now() WHERE id=p_menu;
 WHEN 'assign' THEN
 SELECT * INTO target FROM restaurants WHERE id=p_data->>'outletId' AND organization_id=r.organization_id;
 IF target.id IS NULL OR NOT app_private.can_outlet(target.id,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 IF target.currency<>doc->>'currency' THEN RAISE EXCEPTION 'Explicit repricing required' USING ERRCODE='22023';END IF;
 IF (p_data->>'assigned')::boolean THEN
 INSERT INTO menu_assignments(organization_id,menu_id,outlet_id,brand_id) VALUES(r.organization_id,p_menu,target.id,p_data->>'brandId') ON CONFLICT(menu_id,outlet_id) DO UPDATE SET brand_id=excluded.brand_id;
 IF m.published_revision IS NOT NULL THEN UPDATE restaurants SET is_published=true,free_menu_enabled=true WHERE id=target.id;END IF;
 ELSE
 IF target.id=m.outlet_id THEN RAISE EXCEPTION 'Origin assignment retained' USING ERRCODE='22023';END IF;
 DELETE FROM menu_overrides WHERE menu_id=p_menu AND outlet_id=target.id;
 DELETE FROM menu_assignments WHERE menu_id=p_menu AND outlet_id=target.id;
 END IF;
 UPDATE menus SET revision=revision+1,updated_at=now() WHERE id=p_menu RETURNING revision INTO v;
 WHEN 'override' THEN
 IF NOT EXISTS(SELECT 1 FROM menu_assignments a WHERE a.menu_id=p_menu AND a.outlet_id=p_data->>'outletId' AND app_private.can_outlet(a.outlet_id,'menu.write')) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 IF NOT EXISTS(SELECT 1 FROM jsonb_array_elements(doc->'categories') c,jsonb_array_elements(c->'items') i WHERE i->>'id'=p_data->>'dishId') THEN RAISE EXCEPTION 'Unknown dish' USING ERRCODE='22023';END IF;
 INSERT INTO menu_overrides(menu_id,outlet_id,dish_id,price_minor,sold_out) VALUES(p_menu,p_data->>'outletId',p_data->>'dishId',(p_data->>'priceMinor')::int,(p_data->>'soldOut')::boolean) ON CONFLICT(menu_id,outlet_id,dish_id) DO UPDATE SET price_minor=excluded.price_minor,sold_out=excluded.sold_out;
 UPDATE menus SET revision=revision+1,updated_at=now() WHERE id=p_menu RETURNING revision INTO v;
 ELSE RAISE EXCEPTION 'Invalid command' USING ERRCODE='22023';END CASE;
 -- Never fall back to an old live catalog after the first versioned publication.
 UPDATE restaurants x SET is_published=EXISTS(SELECT 1 FROM menu_assignments a JOIN menus n ON n.id=a.menu_id WHERE a.outlet_id=x.id AND n.published_revision IS NOT NULL AND NOT n.archived) WHERE x.organization_id=r.organization_id AND x.free_menu_enabled;
 PERFORM app_private.record_org_change(r.organization_id,'menu.'||p_action,p_outlet);
 result:=jsonb_build_object('menuId',p_menu,'revision',v);
 INSERT INTO domain_commands(id,organization_id,actor_id,request_key,command,result) VALUES(gen_random_uuid()::text,r.organization_id,actor,p_key,cmd,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.menu_command(text,text,text,jsonb,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.menu_command(text,text,text,jsonb,text,integer) TO menuminute_app;
-- Currency changes must consider the new catalog as well as legacy prices/history.
CREATE FUNCTION app_private.guard_menu_currency() RETURNS trigger LANGUAGE plpgsql SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.currency<>OLD.currency AND EXISTS(SELECT 1 FROM menu_assignments a JOIN menus m ON m.id=a.menu_id WHERE a.outlet_id=NEW.id AND m.document->>'currency'<>NEW.currency) THEN RAISE EXCEPTION 'Explicit menu repricing required' USING ERRCODE='22023';END IF;RETURN NEW;
END $$;
CREATE TRIGGER menu_currency_guard BEFORE UPDATE OF currency ON restaurants FOR EACH ROW EXECUTE FUNCTION app_private.guard_menu_currency();
CREATE FUNCTION app_private.qr_command(p_outlet text,p_action text,p_data jsonb,p_key text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE;q qr_codes%ROWTYPE;tid text;newid text;token text;cmd jsonb;prior domain_commands%ROWTYPE;result jsonb;
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;PERFORM 1 FROM organizations WHERE id=r.organization_id FOR UPDATE;
 IF NOT app_private.can_outlet(p_outlet,'menu.write') OR p_action IN ('revoke','regenerate') AND NOT app_private.org_admin(r.organization_id) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 cmd:=jsonb_build_object('action',p_action,'outletId',p_outlet,'data',p_data);
 SELECT * INTO prior FROM domain_commands WHERE organization_id=r.organization_id AND actor_id=current_setting('app.actor_id',true) AND request_key=p_key;
 IF FOUND THEN IF prior.command<>cmd THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001';END IF;RETURN prior.result;END IF;
 IF p_action IN ('revoke','regenerate') THEN
 SELECT * INTO q FROM qr_codes WHERE id=p_data->>'qrId' AND restaurant_id=p_outlet;
 IF q.id IS NULL THEN RAISE EXCEPTION 'Unknown QR' USING ERRCODE='22023';END IF;
 UPDATE qr_codes SET is_active=false WHERE id=q.id;
 END IF;
 IF p_action='create' THEN
 IF p_data->>'pointLabel' IS NOT NULL THEN
 tid:=gen_random_uuid()::text;INSERT INTO restaurant_tables(id,restaurant_id,table_number,label) VALUES(tid,p_outlet,tid,p_data->>'pointLabel');
 END IF;
 ELSIF p_action='regenerate' THEN tid:=q.table_id;
 ELSIF p_action<>'revoke' THEN RAISE EXCEPTION 'Invalid QR action' USING ERRCODE='22023';END IF;
 IF p_action<>'revoke' THEN
 newid:=gen_random_uuid()::text;token:=gen_random_uuid()::text;
 INSERT INTO qr_codes(id,restaurant_id,table_id,label,destination_token,purpose) VALUES(newid,p_outlet,tid,COALESCE(p_data->>'label',q.label,'Menu QR'),token,'menu');
 IF p_action='regenerate' AND q.destination_token=r.public_id THEN UPDATE restaurants SET public_id=token WHERE id=p_outlet;END IF;
 result:=jsonb_build_object('id',newid,'token',token);
 ELSE result:=jsonb_build_object('id',q.id,'revoked',true);END IF;
 PERFORM app_private.record_org_change(r.organization_id,'qr.'||p_action,p_outlet);
 INSERT INTO domain_commands(id,organization_id,actor_id,request_key,command,result) VALUES(gen_random_uuid()::text,r.organization_id,current_setting('app.actor_id',true),p_key,cmd,result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.qr_command(text,text,jsonb,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.qr_command(text,text,jsonb,text) TO menuminute_app;
CREATE FUNCTION app_private.media_command(p_outlet text,p_id text,p_action text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; a dish_media%ROWTYPE;eid text;
BEGIN
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;PERFORM 1 FROM organizations WHERE id=r.organization_id FOR UPDATE;
 IF NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM dish_media WHERE id=p_id AND outlet_id=p_outlet;
 CASE p_action
 WHEN 'reserve' THEN
 IF a.id IS NOT NULL THEN RAISE EXCEPTION 'Upload exists' USING ERRCODE='40001';END IF;
 IF (SELECT count(*) FROM dish_media WHERE outlet_id=p_outlet AND created_at>now()-interval '1 hour')>=30 OR COALESCE((SELECT sum(size_bytes) FROM dish_media WHERE outlet_id=p_outlet),0)+(p_data->>'sizeBytes')::int>(p_data->>'budget')::bigint THEN RAISE EXCEPTION 'Operational media budget reached' USING ERRCODE='54000';END IF;
 INSERT INTO dish_media(id,organization_id,outlet_id,actor_id,size_bytes,source_key,rights) VALUES(p_id,r.organization_id,p_outlet,current_setting('app.actor_id',true),(p_data->>'sizeBytes')::int,r.organization_id||'/'||p_id||'/original',p_data->>'rights');
 WHEN 'queue' THEN
 IF a.id IS NULL THEN RAISE EXCEPTION 'Unknown upload' USING ERRCODE='22023';END IF;
 IF a.status='uploading' THEN
 UPDATE dish_media SET status='queued' WHERE id=p_id;
 eid:=gen_random_uuid()::text;
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload) VALUES(eid,r.organization_id,p_outlet,'media.process',1,1,jsonb_build_object('mediaId',p_id));
 END IF;
 WHEN 'approve' THEN
 IF a.status<>'ready' OR a.id IS NULL THEN RAISE EXCEPTION 'Ready media required' USING ERRCODE='22023';END IF;
 UPDATE dish_media SET approved_at=now(),approved_by=current_setting('app.actor_id',true) WHERE id=p_id;
 WHEN 'unapprove' THEN UPDATE dish_media SET approved_at=NULL,approved_by=NULL WHERE id=p_id;
 ELSE RAISE EXCEPTION 'Unknown media action' USING ERRCODE='22023';END CASE;
 PERFORM app_private.record_org_change(r.organization_id,'media.'||p_action,p_outlet);
 RETURN (SELECT jsonb_build_object('id',id,'status',status,'sourceKey',source_key) FROM dish_media WHERE id=p_id AND outlet_id=p_outlet);
END $$;
REVOKE ALL ON FUNCTION app_private.media_command(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.media_command(text,text,text,jsonb) TO menuminute_app;
-- Narrow RPCs for the isolated worker; no merchant/auth table grants.
GRANT USAGE ON SCHEMA app_private TO menuminute_worker;
CREATE FUNCTION app_private.media_job(p_event text,p_org text,p_finish jsonb DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE e outbox_events%ROWTYPE;a dish_media%ROWTYPE;allowed boolean;
BEGIN
 SELECT * INTO e FROM outbox_events WHERE id=p_event AND organization_id=p_org AND type='media.process';
 IF e.id IS NULL THEN RAISE EXCEPTION 'Invalid scope' USING ERRCODE='42501';END IF;
 SELECT * INTO a FROM dish_media WHERE id=e.payload->>'mediaId' AND organization_id=p_org;
 IF a.id IS NULL THEN RAISE EXCEPTION 'Unknown media' USING ERRCODE='22023';END IF;
 PERFORM 1 FROM organizations WHERE id=p_org FOR UPDATE;
 SELECT * INTO e FROM outbox_events WHERE id=p_event AND organization_id=p_org FOR UPDATE;
 SELECT * INTO a FROM dish_media WHERE id=e.payload->>'mediaId' AND organization_id=p_org FOR UPDATE;
 IF EXISTS(SELECT 1 FROM consumer_receipts WHERE event_id=e.id AND consumer='dish-media-v1') THEN RETURN jsonb_build_object('done',true);END IF;
 PERFORM set_config('app.actor_id',a.actor_id,true);
 allowed:=app_private.can_outlet(a.outlet_id,'menu.write');
 IF p_finish IS NOT NULL OR NOT allowed THEN
 IF EXISTS(SELECT 1 FROM consumer_receipts WHERE event_id=e.id AND consumer='dish-media-v1') THEN RETURN jsonb_build_object('done',true);END IF;
 IF NOT allowed OR p_finish?'error' THEN UPDATE dish_media SET status='failed',last_error=CASE WHEN allowed THEN 'invalid_image' ELSE 'authority_revoked' END WHERE id=a.id AND status<>'ready';
 ELSE
 IF p_finish->>'key'<>p_org||'/'||a.id||'/display.webp' OR p_finish->>'thumbnail'<>p_org||'/'||a.id||'/thumb.webp' THEN RAISE EXCEPTION 'Invalid key' USING ERRCODE='22023';END IF;
 UPDATE dish_media SET status='ready',derivative_key=p_finish->>'key',thumbnail_key=p_finish->>'thumbnail',width=(p_finish->>'width')::int,height=(p_finish->>'height')::int,last_error=NULL WHERE id=a.id;
 END IF;
 PERFORM app_private.record_org_change(p_org,'media.processed',a.outlet_id);
 INSERT INTO consumer_receipts(event_id,consumer,organization_id) VALUES(e.id,'dish-media-v1',p_org) ON CONFLICT DO NOTHING;
 UPDATE outbox_events SET status='completed',completed_at=now(),lease_token=NULL,lease_until=NULL WHERE id=e.id;
 RETURN jsonb_build_object('done',true);
 END IF;
 RETURN jsonb_build_object('id',a.id,'sourceKey',a.source_key,'status',a.status);
END $$;
REVOKE ALL ON FUNCTION app_private.media_job(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.media_job(text,text,jsonb) TO menuminute_worker;
CREATE FUNCTION app_private.reconcile_media_uploads() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a dish_media%ROWTYPE;n integer:=0;
BEGIN
 FOR a IN SELECT * FROM dish_media WHERE status='uploading' AND created_at<now()-interval '2 minutes' ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 10 LOOP
 UPDATE dish_media SET status='queued' WHERE id=a.id;
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload) VALUES(gen_random_uuid()::text,a.organization_id,a.outlet_id,'media.process',1,1,jsonb_build_object('mediaId',a.id));n:=n+1;
 END LOOP;RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.reconcile_media_uploads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.reconcile_media_uploads() TO menuminute_worker;
CREATE FUNCTION app_private.free_menu_public(p_token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('outlet',jsonb_build_object('id',r.id,'name',r.name,'currency',r.currency,'timezone',r.timezone,'outletType',r.outlet_type,'fulfillmentModes',r.fulfillment_modes,'isDemoData',r.is_demo_data,'versioned',r.free_menu_enabled),'point',t.label,'now',statement_timestamp(),
 'menus',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'revision',rel.revision,'document',rel.document,'brand',b.name,'overrides',COALESCE((SELECT jsonb_agg(jsonb_build_object('dishId',o.dish_id,'priceMinor',o.price_minor,'soldOut',o.sold_out)) FROM menu_overrides o WHERE o.menu_id=m.id AND o.outlet_id=r.id),'[]'::jsonb))) FROM menu_assignments a JOIN menus m ON m.id=a.menu_id JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision LEFT JOIN brands b ON b.id=a.brand_id WHERE a.outlet_id=r.id AND NOT m.archived),'[]'::jsonb))
 FROM qr_codes q JOIN restaurants r ON r.id=q.restaurant_id JOIN organizations org ON org.id=r.organization_id LEFT JOIN restaurant_tables t ON t.id=q.table_id AND t.restaurant_id=r.id
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND r.is_published AND org.is_active LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.free_menu_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.free_menu_public(text) TO menuminute_app;
CREATE FUNCTION app_private.public_dish_media(p_id text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('key',a.derivative_key,'thumbnail',a.thumbnail_key,'width',a.width,'height',a.height) FROM dish_media a JOIN organizations org ON org.id=a.organization_id
 WHERE a.id=p_id AND a.status='ready' AND a.approved_at IS NOT NULL AND org.is_active AND EXISTS(SELECT 1 FROM menu_releases rel JOIN menus m ON m.id=rel.menu_id AND m.published_revision=rel.revision JOIN menu_assignments ass ON ass.menu_id=m.id JOIN restaurants r ON r.id=ass.outlet_id WHERE NOT m.archived AND r.is_active AND r.is_published AND r.organization_id=a.organization_id AND EXISTS(SELECT 1 FROM jsonb_array_elements(rel.document->'categories') c,jsonb_array_elements(c->'items') i WHERE i->>'mediaId'=a.id AND NOT (c->>'archived')::boolean AND NOT (i->>'archived')::boolean))
$$;
REVOKE ALL ON FUNCTION app_private.public_dish_media(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.public_dish_media(text) TO menuminute_app;

CREATE INDEX menu_assignment_outlet ON menu_assignments(outlet_id,menu_id);
CREATE INDEX pending_media_reconcile ON dish_media(created_at) WHERE status='uploading';
CREATE INDEX media_outlet_created ON dish_media(outlet_id,created_at);

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
 INSERT INTO restaurants(id,organization_id,public_id,name,slug,description,city,country,currency,timezone,outlet_type,fulfillment_modes)
 VALUES(outlet,org,token,request_input->>'name',outlet,request_input->>'description',request_input->>'city',request_input->>'country',request_input->>'currency',request_input->>'timezone',request_input->>'outletType',COALESCE((SELECT array_agg(value) FROM jsonb_array_elements_text(request_input->'fulfillmentModes')),CASE WHEN request_input->>'outletType' IN ('cafe','takeout','cloud_kitchen') THEN ARRAY['pickup']::text[] ELSE ARRAY['dine_in']::text[] END));
 INSERT INTO app_private.provisioning_requests(outlet_id,actor_id,input) VALUES(outlet,actor,request_input-'svgData');
 INSERT INTO brands(id,organization_id,name) VALUES('brand-'||outlet,org,request_input->>'name');
 INSERT INTO brand_outlets(organization_id,brand_id,outlet_id) VALUES(org,'brand-'||outlet,outlet);
 INSERT INTO qr_codes(id,restaurant_id,destination_token,svg_data,label) VALUES('qr-'||outlet,outlet,token,request_input->>'svgData','Main Menu QR');

 INSERT INTO menus(id,organization_id,outlet_id,document) VALUES('menu-'||outlet,org,outlet,jsonb_build_object('name','Our menu','currency',request_input->>'currency','schedule',COALESCE(request_input->'menuSchedule','null'::jsonb),'categories','[]'::jsonb));
 INSERT INTO menu_assignments(organization_id,menu_id,outlet_id) VALUES(org,'menu-'||outlet,outlet);
 PERFORM app_private.record_org_change(org,'organization.created',outlet);
END $$;
REVOKE ALL ON FUNCTION app_private.provision_organization(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.provision_organization(text,text,jsonb) TO menuminute_app;



ALTER TABLE menus ADD CONSTRAINT menu_origin_scope FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id);
ALTER TABLE menu_releases ADD CONSTRAINT release_scope FOREIGN KEY(organization_id,menu_id) REFERENCES menus(organization_id,id);
ALTER TABLE dish_media ADD CONSTRAINT dish_media_scope FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id);
