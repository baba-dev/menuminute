-- Hospitality Visual Dining Floor & Table Reservations.
-- Forward-only migration following 0064.

CREATE TABLE IF NOT EXISTS dining_floor_plans (
  outlet_id text PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  layout jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dining_reservations (
  id text PRIMARY KEY,
  outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id text REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  guest_name text NOT NULL,
  guest_phone text,
  guest_email text,
  party_size integer NOT NULL,
  reservation_time timestamptz NOT NULL,
  duration_minutes integer NOT NULL DEFAULT 90,
  status text NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed','seated','completed','cancelled','no_show')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dining_res_outlet_time_idx ON dining_reservations(outlet_id, reservation_time);
CREATE INDEX IF NOT EXISTS dining_res_table_idx ON dining_reservations(table_id);

ALTER TABLE dining_floor_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE dining_reservations ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dining_floor_plans' AND policyname = 'dining_floor_plans_app_all'
  ) THEN
    CREATE POLICY dining_floor_plans_app_all ON dining_floor_plans FOR ALL TO menuminute_app USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dining_floor_plans' AND policyname = 'dining_floor_plans_worker_all'
  ) THEN
    CREATE POLICY dining_floor_plans_worker_all ON dining_floor_plans FOR ALL TO menuminute_worker USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dining_reservations' AND policyname = 'dining_reservations_app_all'
  ) THEN
    CREATE POLICY dining_reservations_app_all ON dining_reservations FOR ALL TO menuminute_app USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dining_reservations' AND policyname = 'dining_reservations_worker_all'
  ) THEN
    CREATE POLICY dining_reservations_worker_all ON dining_reservations FOR ALL TO menuminute_worker USING (true) WITH CHECK (true);
  END IF;
END $$;

GRANT SELECT, INSERT, UPDATE, DELETE ON dining_floor_plans TO menuminute_app, menuminute_worker;
GRANT SELECT, INSERT, UPDATE, DELETE ON dining_reservations TO menuminute_app, menuminute_worker;

-- Allow migration owner (CURRENT_USER) full access on new tables
CREATE POLICY dining_floor_plans_owner ON dining_floor_plans FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
CREATE POLICY dining_reservations_owner ON dining_reservations FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);

-- Update public demo reset function to restore floor layout and reservations
CREATE OR REPLACE FUNCTION app_private.reset_demo_outlet(p_baseline jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  o CONSTANT text := 'demo-outlet';
  org CONSTANT text := 'org-demo-outlet';
  mid CONSTANT text := 'menu-demo-outlet';
  rev integer;
  locale_row record;
  tbl jsonb;
  res jsonb;
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

  -- Versioned menu: monotonic revision so the public-menu cache generation can never go backwards.
  DELETE FROM menu_overrides WHERE outlet_id=o;
  DELETE FROM menu_translation_revisions WHERE menu_id=mid;
  DELETE FROM menu_translations WHERE menu_id=mid;
  DELETE FROM menu_releases WHERE menu_id=mid;
  SELECT revision+1 INTO rev FROM menus WHERE id=mid AND organization_id=org AND outlet_id=o FOR UPDATE;
  IF rev IS NULL THEN RAISE EXCEPTION 'Demo menu is not provisioned' USING ERRCODE='42501'; END IF;
  UPDATE menus SET document=p_baseline->'menu', revision=rev, published_revision=rev, archived=false, updated_at=now() WHERE id=mid;
  INSERT INTO menu_releases(menu_id,revision,organization_id,document,published_by) VALUES(mid,rev,org,p_baseline->'menu','demo-owner');
  IF jsonb_typeof(p_baseline->'translations')='object' THEN
    FOR locale_row IN SELECT key AS locale, value AS doc FROM jsonb_each(p_baseline->'translations') LOOP
      INSERT INTO menu_translations(organization_id,menu_id,locale,revision,source_revision,document,reviewed_by)
      VALUES(org,mid,locale_row.locale,1,rev,locale_row.doc,'demo-owner');
    END LOOP;
  END IF;

  -- Floor plan tables.
  DELETE FROM restaurant_tables WHERE restaurant_id=o;
  FOR tbl IN SELECT * FROM jsonb_array_elements(p_baseline->'tables') LOOP
    INSERT INTO restaurant_tables(id,restaurant_id,table_number,label,capacity)
    VALUES(tbl->>'id',o,tbl->>'number',tbl->>'label',(tbl->>'capacity')::integer);
  END LOOP;

  -- Restore visual floor plan layout
  DELETE FROM dining_floor_plans WHERE outlet_id=o;
  IF jsonb_typeof(p_baseline->'floorPlan')='object' THEN
    INSERT INTO dining_floor_plans(outlet_id, layout)
    VALUES(o, p_baseline->'floorPlan');
  END IF;

  -- Restore sample reservations
  DELETE FROM dining_reservations WHERE outlet_id=o;
  IF jsonb_typeof(p_baseline->'reservations')='array' THEN
    FOR res IN SELECT * FROM jsonb_array_elements(p_baseline->'reservations') LOOP
      INSERT INTO dining_reservations(id, outlet_id, table_id, guest_name, guest_phone, party_size, reservation_time, duration_minutes, status, notes)
      VALUES(
        res->>'id', o, res->>'tableId', res->>'guestName', res->>'guestPhone',
        (res->>'partySize')::integer, (res->>'reservationTime')::timestamptz,
        COALESCE((res->>'durationMinutes')::integer, 90),
        COALESCE(res->>'status', 'confirmed'), res->>'notes'
      );
    END LOOP;
  END IF;

  -- Public identity of the outlet.
  IF jsonb_typeof(p_baseline->'outlet')='object' THEN
    UPDATE restaurants SET
      name=COALESCE(p_baseline->'outlet'->>'name',name),
      description=COALESCE(p_baseline->'outlet'->>'description',description),
      city=COALESCE(p_baseline->'outlet'->>'city',city),
      is_published=true
    WHERE id=o;
  END IF;

  counts:=counts||jsonb_build_object('menuRevision',rev);
  INSERT INTO app_private.demo_reset_runs(summary) VALUES(counts);
  DELETE FROM app_private.demo_reset_runs WHERE id < (SELECT max(id)-199 FROM app_private.demo_reset_runs);
  RETURN counts;
END $$;
REVOKE ALL ON FUNCTION app_private.reset_demo_outlet(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.reset_demo_outlet(jsonb) TO menuminute_worker;
