-- Demo kitchen/entitlement provisioning and seeded order history (public demo exception, see AGENTS.md).
-- Both functions are hardcoded to demo-outlet/org-demo-outlet and refuse unless the outlet is flagged
-- is_demo_data. provision_demo_ops is the OWNER-APPROVED demo-only bypass of the Kitchen Pro pilot gate:
-- it is executable by the migration owner only (operator script), never by web, worker or billing roles.
-- Forward-only: reset_demo_outlet is replaced with a superset of its 0059 behaviour.

CREATE OR REPLACE FUNCTION app_private.provision_demo_ops() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  o CONSTANT text := 'demo-outlet';
  org CONSTANT text := 'org-demo-outlet';
  doc jsonb; cat jsonb; item jsonb; st text; routed integer := 0; grants integer := 0; rec record;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM restaurants WHERE id=o AND organization_id=org AND is_demo_data) THEN
    RAISE EXCEPTION 'Demo outlet is not provisioned' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('demo-ops-provision',0));
  -- Serve the versioned, published menu document (otherwise the public path falls back to legacy tables).
  UPDATE restaurants SET free_menu_enabled=true WHERE id=o AND NOT free_menu_enabled;

  -- Demo staff: verified rows WITHOUT any credential, so nobody can sign in as them.
  INSERT INTO users(id,name,email,email_verified,is_demo_data) VALUES
    ('demo-chef','Demo Chef','demo-chef@demo.menuminute.invalid',true,true),
    ('demo-expo','Demo Expeditor','demo-expo@demo.menuminute.invalid',true,true),
    ('demo-manager','Demo Manager','demo-manager@demo.menuminute.invalid',true,true)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO organization_members(id,organization_id,user_id,role) VALUES
    ('member-demo-chef',org,'demo-chef','member'),
    ('member-demo-expo',org,'demo-expo','member'),
    ('member-demo-manager',org,'demo-manager','member')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO outlet_grants(organization_id,member_id,outlet_id,roles)
  SELECT org,v.m,o,v.r FROM (VALUES
    ('member-demo-chef',ARRAY['kitchen']::text[]),
    ('member-demo-expo',ARRAY['kitchen']::text[]),
    ('member-demo-manager',ARRAY['manager']::text[])) AS v(m,r)
  WHERE NOT EXISTS(SELECT 1 FROM outlet_grants g WHERE g.member_id=v.m AND g.outlet_id=o);

  INSERT INTO kitchen_stations(id,outlet_id,name,position) VALUES
    ('demo-st-tandoor',o,'Tandoor & Grill',1),
    ('demo-st-wok',o,'Wok & Fry',2),
    ('demo-st-curry',o,'Curry & Rice',3),
    ('demo-st-cold',o,'Cold & Sweet',4)
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO kitchen_station_members(outlet_id,station_id,member_id,organization_id)
  SELECT o,s.id,m.id,org FROM kitchen_stations s
  CROSS JOIN (VALUES ('member-demo-chef'),('member-demo-expo'),('member-demo-manager'),('member-demo-outlet')) AS m(id)
  WHERE s.outlet_id=o AND s.id LIKE 'demo-st-%'
  ON CONFLICT (station_id,member_id) DO NOTHING;

  -- Route every published dish to a station by category so kitchen readiness holds after each reset.
  SELECT document INTO doc FROM menus WHERE id='menu-demo-outlet' AND organization_id=org;
  FOR cat IN SELECT * FROM jsonb_array_elements(COALESCE(doc->'categories','[]'::jsonb)) LOOP
    st:=CASE cat->>'id'
      WHEN 'cat-starters' THEN 'demo-st-tandoor' WHEN 'cat-breads' THEN 'demo-st-tandoor' WHEN 'cat-cafe-grill' THEN 'demo-st-tandoor'
      WHEN 'cat-indo-chinese' THEN 'demo-st-wok' WHEN 'cat-chaat' THEN 'demo-st-wok' WHEN 'cat-south-indian' THEN 'demo-st-wok'
      WHEN 'cat-desserts' THEN 'demo-st-cold' WHEN 'cat-sides' THEN 'demo-st-cold'
      ELSE 'demo-st-curry' END;
    FOR item IN SELECT * FROM jsonb_array_elements(cat->'items') LOOP
      INSERT INTO kitchen_routes(outlet_id,dish_id,station_id) VALUES(o,item->>'id',st) ON CONFLICT DO NOTHING;
      routed:=routed+1;
    END LOOP;
  END LOOP;

  -- Entitlements: Ordering and Kitchen Pro for ten years (no payment provider involved).
  FOR rec IN SELECT * FROM (VALUES ('ordering.new','demo-ordering-grant-v1'),('kitchen.new','demo-kitchen-grant-v1')) AS v(capability,key) LOOP
    IF NOT EXISTS(SELECT 1 FROM entitlement_grants WHERE organization_id=org AND capability=rec.capability
        AND revoked_at IS NULL AND starts_at<=clock_timestamp() AND ends_at>clock_timestamp()+interval '1 year') THEN
      INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
      VALUES(gen_random_uuid()::text,org,rec.capability,'INR',clock_timestamp()-interval '1 minute',clock_timestamp()+interval '10 years',
        'demo','Public demo tenant (owner-approved exception, AGENTS.md)',rec.key||'-'||gen_random_uuid()::text);
      grants:=grants+1;
    END IF;
  END LOOP;

  IF NOT COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=o),false) THEN
    INSERT INTO kitchen_outlet_settings(outlet_id,enabled) VALUES(o,true)
    ON CONFLICT (outlet_id) DO UPDATE SET enabled=true,revision=kitchen_outlet_settings.revision+1,updated_at=clock_timestamp();
    PERFORM app_private.kitchen_emit(o,'settings.changed');
  END IF;
  RETURN jsonb_build_object('routedDishes',routed,'newGrants',grants);
END $$;
REVOKE ALL ON FUNCTION app_private.provision_demo_ops() FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Internal: called only from reset_demo_outlet (same owner). Not granted to any application role.
CREATE OR REPLACE FUNCTION app_private.seed_demo_orders(p_orders jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  o CONSTANT text := 'demo-outlet';
  ord jsonb; itm jsonb; ev jsonb; step text; tz text; cur text;
  created timestamptz; bdate date; total bigint; n integer := 0; live boolean; prev text; ver integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM restaurants WHERE id=o AND is_demo_data) THEN
    RAISE EXCEPTION 'Demo outlet is not provisioned' USING ERRCODE='42501';
  END IF;
  SELECT timezone INTO tz FROM restaurants WHERE id=o;
  PERFORM set_config('app.actor_id','demo-manager',true);
  FOR ord IN SELECT * FROM jsonb_array_elements(p_orders) LOOP
    created:=clock_timestamp()-make_interval(mins=>(ord->>'minutesAgo')::integer);
    bdate:=(created AT TIME ZONE tz)::date;
    SELECT COALESCE(sum((i->>'quantity')::bigint*(i->>'unitPriceMinor')::bigint),0) INTO total
    FROM jsonb_array_elements(ord->'items') i;
    live:=COALESCE((ord->>'live')::boolean,false);
    INSERT INTO orders(id,restaurant_id,table_id,customer_name,fulfillment_mode,status,payment_status,currency,
      subtotal_minor,tax_minor,total_minor,subtotal_paise,tax_paise,total_paise,order_number,created_at,updated_at,
      tracking_token,expires_at,business_date,intake_source,version,rejection_reason,notes)
    VALUES(ord->>'id',o,NULLIF(ord->>'tableId',''),ord->>'customerName',ord->>'mode',
      CASE WHEN live THEN 'pending' ELSE ord->>'status' END,
      CASE WHEN ord->>'paymentStatus' IN ('paid','voided') AND NOT live THEN ord->>'paymentStatus' ELSE 'unpaid' END,
      'INR',total,0,total,total,0,total,(ord->>'number')::integer,created,created,
      'trk-'||(ord->>'id'),
      CASE WHEN live THEN clock_timestamp()+interval '25 minutes' ELSE created+interval '2 hours' END,
      bdate,COALESCE(ord->>'intake','guest_menu'),1,NULLIF(ord->>'rejection',''),NULLIF(ord->>'notes',''));
    FOR itm IN SELECT * FROM jsonb_array_elements(ord->'items') LOOP
      INSERT INTO order_items(id,order_id,restaurant_id,menu_item_id,dish_id,variant_id,item_name,variant_name,
        selected_options,unit_price_minor,total_minor,unit_price_paise,total_paise,quantity,notes)
      VALUES(gen_random_uuid()::text,ord->>'id',o,NULL,itm->>'dishId',NULLIF(itm->>'variantId',''),itm->>'dishName',
        NULLIF(itm->>'variantName',''),COALESCE(itm->'selectedOptions','[]'::jsonb),(itm->>'unitPriceMinor')::integer,
        (itm->>'quantity')::integer*(itm->>'unitPriceMinor')::integer,(itm->>'unitPriceMinor')::integer,
        (itm->>'quantity')::integer*(itm->>'unitPriceMinor')::integer,(itm->>'quantity')::integer,NULLIF(itm->>'notes',''));
    END LOOP;
    -- Recorded history: events as given. Live orders: progress through real UPDATEs below.
    prev:=NULL;
    IF NOT live THEN
      FOR ev IN SELECT * FROM jsonb_array_elements(COALESCE(ord->'events','[]'::jsonb)) LOOP
        INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id,created_at)
        VALUES(gen_random_uuid()::text,ord->>'id',o,NULLIF(ev->>'from',''),ev->>'to',ev->>'to',
          COALESCE(NULLIF(ev->>'note',''),'Status updated to '||(ev->>'to')),
          CASE WHEN ev->>'to'='pending' THEN 'guest' ELSE 'staff' END,
          CASE WHEN ev->>'to'='pending' THEN NULL ELSE 'demo-manager' END,
          clock_timestamp()-make_interval(mins=>(ev->>'minutesAgo')::integer));
      END LOOP;
      UPDATE orders SET updated_at=clock_timestamp()-make_interval(mins=>COALESCE((ord->>'updatedMinutesAgo')::integer,(ord->>'minutesAgo')::integer))
      WHERE id=ord->>'id';
    ELSE
      INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,created_at)
      VALUES(gen_random_uuid()::text,ord->>'id',o,NULL,'pending','pending','Order placed','guest',created);
      cur:='pending'; ver:=1;
      FOR step IN SELECT jsonb_array_elements_text(COALESCE(ord->'liveSteps','[]'::jsonb)) LOOP
        ver:=ver+1;
        UPDATE orders SET status=step,version=ver,updated_at=clock_timestamp() WHERE id=ord->>'id';
        INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
        VALUES(gen_random_uuid()::text,ord->>'id',o,cur,step,step,'Status updated to '||step,'staff','demo-manager');
        cur:=step;
      END LOOP;
      IF cur='preparing' THEN
        UPDATE kitchen_work SET status='preparing',version=version+1,updated_at=clock_timestamp()
        WHERE order_id=ord->>'id' AND outlet_id=o;
      ELSIF cur='ready' THEN
        UPDATE kitchen_work SET status='complete',version=version+1,updated_at=clock_timestamp()
        WHERE order_id=ord->>'id' AND outlet_id=o;
      END IF;
    END IF;
    INSERT INTO app_private.order_counters(restaurant_id,business_date,last_order_number)
    VALUES(o,bdate,(ord->>'number')::integer)
    ON CONFLICT (restaurant_id,business_date)
    DO UPDATE SET last_order_number=GREATEST(app_private.order_counters.last_order_number,EXCLUDED.last_order_number);
    n:=n+1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.seed_demo_orders(jsonb) FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE OR REPLACE FUNCTION app_private.reset_demo_outlet(p_baseline jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  o CONSTANT text := 'demo-outlet';
  org CONSTANT text := 'org-demo-outlet';
  mid CONSTANT text := 'menu-demo-outlet';
  rev integer;
  cur record;
  locale_row record;
  tbl jsonb;
  counts jsonb := '{}'::jsonb;
  n bigint;
BEGIN
  IF p_baseline IS NULL OR jsonb_typeof(p_baseline->'menu') IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_baseline->'tables') IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid demo baseline' USING ERRCODE='22023';
  END IF;
  IF octet_length(p_baseline->>'menu') > 500000 THEN
    RAISE EXCEPTION 'Demo baseline menu too large' USING ERRCODE='22023';
  END IF;
  IF NOT EXISTS(SELECT 1 FROM restaurants WHERE id=o AND organization_id=org AND is_demo_data) THEN
    RAISE EXCEPTION 'Demo outlet is not provisioned' USING ERRCODE='42501';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('demo-outlet-reset',0));

  -- Runtime state, children before parents.
  DELETE FROM kitchen_work_history WHERE outlet_id=o; GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('kitchen_work_history',n);
  DELETE FROM kitchen_work WHERE outlet_id=o; GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('kitchen_work',n);
  DELETE FROM kitchen_command_receipts WHERE outlet_id=o;
  DELETE FROM kitchen_events WHERE outlet_id=o;
  DELETE FROM guest_service_requests WHERE outlet_id=o; GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('guest_service_requests',n);
  DELETE FROM order_status_events WHERE restaurant_id=o;
  DELETE FROM order_items WHERE restaurant_id=o;
  DELETE FROM orders WHERE restaurant_id=o; GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('orders',n);
  DELETE FROM assistant_attempts WHERE outlet_id=o;
  DELETE FROM assistant_action_proposals WHERE outlet_id=o;
  DELETE FROM assistant_turns WHERE outlet_id=o;
  DELETE FROM assistant_conversations WHERE outlet_id=o; GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('assistant_conversations',n);
  DELETE FROM menu_import_ai_usage WHERE outlet_id=o;
  DELETE FROM menu_import_candidates WHERE outlet_id=o;
  DELETE FROM menu_import_reviews WHERE outlet_id=o;
  DELETE FROM menu_import_sources WHERE outlet_id=o;
  DELETE FROM menu_imports WHERE outlet_id=o; GET DIAGNOSTICS n=ROW_COUNT; counts:=counts||jsonb_build_object('menu_imports',n);
  DELETE FROM dish_media WHERE outlet_id=o;
  DELETE FROM outbox_events WHERE outlet_id=o OR organization_id=org;
  DELETE FROM domain_commands WHERE organization_id=org;
  DELETE FROM organization_invitations WHERE organization_id=org;

  -- Versioned menu. The revision is monotonic so a public-menu cache generation never goes backwards,
  -- but it is NOT bumped when the visitor left the published menu untouched: the guest order path
  -- compares a fingerprint that includes the revision, and the worker cannot invalidate the web cache,
  -- so a needless bump would make guests' orders conflict for up to the cache TTL after every reset.
  DELETE FROM menu_overrides WHERE outlet_id=o;
  DELETE FROM menu_translation_revisions WHERE menu_id=mid;
  DELETE FROM menu_translations WHERE menu_id=mid;
  SELECT revision, published_revision, document INTO cur FROM menus WHERE id=mid AND organization_id=org AND outlet_id=o FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Demo menu is not provisioned' USING ERRCODE='42501'; END IF;
  IF cur.published_revision IS NOT DISTINCT FROM cur.revision AND cur.document=p_baseline->'menu'
     AND EXISTS(SELECT 1 FROM menu_releases WHERE menu_id=mid AND revision=cur.revision AND document=p_baseline->'menu') THEN
    rev:=cur.revision;
    DELETE FROM menu_releases WHERE menu_id=mid AND revision<>rev;
  ELSE
    rev:=cur.revision+1;
    DELETE FROM menu_releases WHERE menu_id=mid;
    UPDATE menus SET document=p_baseline->'menu', revision=rev, published_revision=rev, archived=false, updated_at=now() WHERE id=mid;
    INSERT INTO menu_releases(menu_id,revision,organization_id,document,published_by) VALUES(mid,rev,org,p_baseline->'menu','demo-owner');
  END IF;
  IF jsonb_typeof(p_baseline->'translations')='object' THEN
    FOR locale_row IN SELECT key AS locale, value AS doc FROM jsonb_each(p_baseline->'translations') LOOP
      INSERT INTO menu_translations(organization_id,menu_id,locale,revision,source_revision,document,reviewed_by)
      VALUES(org,mid,locale_row.locale,1,rev,locale_row.doc,'demo-owner');
    END LOOP;
  END IF;

  -- Floor plan.
  DELETE FROM restaurant_tables WHERE restaurant_id=o;
  FOR tbl IN SELECT * FROM jsonb_array_elements(p_baseline->'tables') LOOP
    INSERT INTO restaurant_tables(id,restaurant_id,table_number,label,capacity)
    VALUES(tbl->>'id',o,tbl->>'number',tbl->>'label',(tbl->>'capacity')::integer);
  END LOOP;

  -- Public identity of the outlet.
  IF jsonb_typeof(p_baseline->'outlet')='object' THEN
    UPDATE restaurants SET
      name=COALESCE(p_baseline->'outlet'->>'name',name),
      description=COALESCE(p_baseline->'outlet'->>'description',description),
      city=COALESCE(p_baseline->'outlet'->>'city',city),
      is_published=true,
      free_menu_enabled=true
    WHERE id=o;
  END IF;

  -- Seeded order history and live orders (final statuses inserted directly; live ones progress by
  -- UPDATE so the normal kitchen fan-out triggers create station work when the kitchen is enabled).
  IF jsonb_typeof(p_baseline->'orders')='array' THEN
    counts:=counts||jsonb_build_object('seededOrders',app_private.seed_demo_orders(p_baseline->'orders'));
  END IF;

  counts:=counts||jsonb_build_object('menuRevision',rev);
  INSERT INTO app_private.demo_reset_runs(summary) VALUES(counts);
  DELETE FROM app_private.demo_reset_runs WHERE id < (SELECT max(id)-199 FROM app_private.demo_reset_runs);
  RETURN counts;
END $$;
REVOKE ALL ON FUNCTION app_private.reset_demo_outlet(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.reset_demo_outlet(jsonb) TO menuminute_worker;
