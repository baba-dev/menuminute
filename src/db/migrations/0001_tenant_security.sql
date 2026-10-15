-- Runtime role is created separately by an administrator; migrations never own its credentials.
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
CREATE SCHEMA app_private;
REVOKE ALL ON SCHEMA app_private FROM PUBLIC;
GRANT USAGE ON SCHEMA public, app_private TO menuminute_app;

ALTER TABLE organization_members ADD CONSTRAINT member_role_valid CHECK (role IN ('owner','admin','member'));
ALTER TABLE outlet_grants ADD CONSTRAINT grant_roles_valid CHECK (cardinality(roles)>0 AND roles <@ ARRAY['manager','service','kitchen','menu_editor']::text[]);
ALTER TABLE restaurants ADD CONSTRAINT outlet_type_valid CHECK (outlet_type IN ('restaurant','cafe','takeout','cloud_kitchen','hotel','mixed'));

CREATE FUNCTION app_private.is_org_member(org text, elevated boolean DEFAULT false) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM organization_members m JOIN organizations o ON o.id=m.organization_id
 WHERE m.organization_id=org AND m.user_id=current_setting('app.actor_id',true) AND m.is_active AND o.is_active
 AND (NOT elevated OR m.role IN ('owner','admin')))
$$;
CREATE FUNCTION app_private.can_outlet(outlet text, permission text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM restaurants r JOIN organizations o ON o.id=r.organization_id
 JOIN organization_members m ON m.organization_id=o.id
 LEFT JOIN outlet_grants g ON g.organization_id=o.id AND g.member_id=m.id AND g.outlet_id=r.id
 WHERE r.id=outlet AND r.is_active AND o.is_active AND m.is_active AND m.user_id=current_setting('app.actor_id',true)
 AND CASE WHEN permission='billing.manage' THEN m.role='owner'
 WHEN m.role IN ('owner','admin') THEN true
 WHEN permission='menu.read' THEN cardinality(g.roles)>0
 WHEN permission='menu.write' THEN g.roles && ARRAY['manager','menu_editor']::text[]
 WHEN permission='outlet.manage' THEN g.roles && ARRAY['manager']::text[]
 WHEN permission='orders.read' THEN g.roles && ARRAY['manager','service','kitchen']::text[]
 WHEN permission IN ('orders.accept','orders.complete') THEN g.roles && ARRAY['manager','service']::text[]
 WHEN permission='orders.prepare' THEN g.roles && ARRAY['manager','kitchen']::text[]
 WHEN permission='orders.cancel' THEN g.roles && ARRAY['manager']::text[] ELSE false END)
$$;
REVOKE ALL ON FUNCTION app_private.is_org_member(text,boolean),app_private.can_outlet(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_org_member(text,boolean),app_private.can_outlet(text,text) TO menuminute_app;

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_read ON organizations FOR SELECT USING(app_private.is_org_member(id));
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_read ON organization_members FOR SELECT USING(app_private.is_org_member(organization_id) AND (user_id=current_setting('app.actor_id',true) OR app_private.is_org_member(organization_id,true)));
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_read ON brands FOR SELECT USING(app_private.is_org_member(organization_id,true) OR EXISTS(SELECT 1 FROM brand_outlets b WHERE b.brand_id=id AND app_private.can_outlet(b.outlet_id,'menu.read')));
ALTER TABLE brand_outlets ENABLE ROW LEVEL SECURITY;
CREATE POLICY brand_link_read ON brand_outlets FOR SELECT USING(app_private.can_outlet(outlet_id,'menu.read'));
ALTER TABLE outlet_grants ENABLE ROW LEVEL SECURITY;
CREATE POLICY grant_read ON outlet_grants FOR SELECT USING(app_private.can_outlet(outlet_id,'menu.read'));
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
CREATE POLICY outlet_read ON restaurants FOR SELECT USING(app_private.can_outlet(id,'menu.read'));
CREATE POLICY outlet_update ON restaurants FOR UPDATE USING(app_private.can_outlet(id,'outlet.manage')) WITH CHECK(app_private.can_outlet(id,'outlet.manage'));

DO $$ DECLARE tbl text; BEGIN
 FOREACH tbl IN ARRAY ARRAY['menu_categories','menu_items','menu_item_variants','menu_media','qr_codes','restaurant_tables','restaurant_subscriptions','orders','order_items','order_status_events','media_assets','ai_usage_records','audit_logs'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',tbl);
  EXECUTE format('CREATE POLICY scoped_read ON %I FOR SELECT USING (app_private.can_outlet(restaurant_id,%L))',tbl,CASE WHEN tbl IN ('orders','order_items','order_status_events') THEN 'orders.read' WHEN tbl='restaurant_subscriptions' THEN 'billing.manage' ELSE 'menu.read' END);
 END LOOP;
 FOREACH tbl IN ARRAY ARRAY['menu_categories','menu_items'] LOOP
  EXECUTE format('CREATE POLICY scoped_insert ON %I FOR INSERT WITH CHECK (restaurant_id=current_setting(%L,true) AND app_private.can_outlet(restaurant_id,%L))',tbl,'app.outlet_id','menu.write');
  EXECUTE format('CREATE POLICY scoped_update ON %I FOR UPDATE USING (restaurant_id=current_setting(%L,true) AND app_private.can_outlet(restaurant_id,%L)) WITH CHECK (restaurant_id=current_setting(%L,true) AND app_private.can_outlet(restaurant_id,%L))',tbl,'app.outlet_id','menu.write','app.outlet_id','menu.write');
 END LOOP;
END $$;
ALTER TABLE background_jobs ENABLE ROW LEVEL SECURITY;
-- No runtime job/order writes are granted until their complete delivery contracts land.
GRANT SELECT ON organizations,organization_members,brands,brand_outlets,outlet_grants,restaurants,menu_categories,menu_items,menu_item_variants,menu_media,qr_codes,restaurant_tables,restaurant_subscriptions,orders,order_items,order_status_events,media_assets,ai_usage_records,audit_logs TO menuminute_app;
GRANT INSERT,UPDATE ON menu_categories,menu_items TO menuminute_app;
GRANT UPDATE ON restaurants TO menuminute_app;
GRANT SELECT ON subscription_plans TO menuminute_app;
GRANT SELECT,INSERT,UPDATE,DELETE ON users,accounts,sessions,verifications,rate_limits TO menuminute_app;

CREATE TABLE app_private.provisioning_requests (outlet_id text PRIMARY KEY REFERENCES restaurants(id),actor_id text NOT NULL,input jsonb NOT NULL);

CREATE FUNCTION app_private.provision_organization(outlet text,token text,input jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=current_setting('app.actor_id',true); org text:='org-'||outlet;
BEGIN
 IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id=actor) THEN RAISE EXCEPTION 'Unknown actor'; END IF;
 IF length(token)<12 OR length(input->>'name') NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Invalid provisioning input'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(outlet,0));
 IF EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id=outlet) THEN
  IF NOT EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id=outlet AND p.actor_id=actor AND p.input=(input-'svgData')) THEN RAISE EXCEPTION 'Provisioning key conflict'; END IF;
  RETURN;
 END IF;
 INSERT INTO organizations(id,name) VALUES(org,input->>'name');
 INSERT INTO organization_members(id,organization_id,user_id,role) VALUES('member-'||outlet,org,actor,'owner');
 INSERT INTO restaurants(id,organization_id,public_id,name,slug,description,city,country,currency,timezone,outlet_type)
 VALUES(outlet,org,token,input->>'name',outlet,input->>'description',input->>'city',input->>'country',input->>'currency',input->>'timezone',input->>'outletType');
 INSERT INTO app_private.provisioning_requests(outlet_id,actor_id,input) VALUES(outlet,actor,input-'svgData');
 INSERT INTO brands(id,organization_id,name) VALUES('brand-'||outlet,org,input->>'name');
 INSERT INTO brand_outlets(organization_id,brand_id,outlet_id) VALUES(org,'brand-'||outlet,outlet);
 INSERT INTO qr_codes(id,restaurant_id,destination_token,svg_data,label) VALUES('qr-'||outlet,outlet,token,input->>'svgData','Main Menu QR');
END $$;
REVOKE ALL ON FUNCTION app_private.provision_organization(text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.provision_organization(text,text,jsonb) TO menuminute_app;

CREATE FUNCTION app_private.public_menu(token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('restaurant',jsonb_build_object('id',r.id,'publicId',r.public_id,'name',r.name,'description',r.description,'phone',r.phone,'city',r.city,'addressLine1',r.address_line1,'primaryColor',r.primary_color,'currency',r.currency,'isDemoData',r.is_demo_data),
 'menu',COALESCE((SELECT jsonb_agg(jsonb_build_object('category',jsonb_build_object('id',c.id,'name',c.name,'description',c.description),'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'name',i.name,'description',i.description,'pricePaise',i.price_paise,'imageUrl',i.image_url,'isVeg',i.is_veg,'isVegan',i.is_vegan,'isGlutenFree',i.is_gluten_free,'spiceLevel',i.spice_level,'isFeatured',i.is_featured,'isAvailable',i.is_available) ORDER BY i.sort_order,i.id) FROM menu_items i WHERE i.category_id=c.id AND i.restaurant_id=r.id),'[]'::jsonb)) ORDER BY c.sort_order,c.id) FROM menu_categories c WHERE c.restaurant_id=r.id AND c.is_active),'[]'::jsonb))
 FROM restaurants r JOIN organizations o ON o.id=r.organization_id
 JOIN qr_codes q ON q.restaurant_id=r.id AND q.destination_token=token AND q.is_active
 WHERE r.is_active AND r.is_published AND o.is_active LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.public_menu(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.public_menu(text) TO menuminute_app;

GRANT USAGE ON SCHEMA drizzle TO menuminute_app;
GRANT SELECT ON drizzle.foundation_migrations TO menuminute_app;

-- Existing editor mutations retain atomic, append-only audit evidence.
CREATE FUNCTION app_private.audit_menu_mutation() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 INSERT INTO audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id,before,after)
 VALUES(gen_random_uuid()::text,NULLIF(current_setting('app.actor_id',true),''),NEW.restaurant_id,TG_OP,TG_TABLE_NAME,NEW.id,
 CASE WHEN TG_OP='UPDATE' THEN row_to_json(OLD)::text ELSE NULL END,row_to_json(NEW)::text);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.audit_menu_mutation() FROM PUBLIC;
CREATE TRIGGER category_audit AFTER INSERT OR UPDATE ON menu_categories FOR EACH ROW EXECUTE FUNCTION app_private.audit_menu_mutation();
CREATE TRIGGER item_audit AFTER INSERT OR UPDATE ON menu_items FOR EACH ROW EXECUTE FUNCTION app_private.audit_menu_mutation();
