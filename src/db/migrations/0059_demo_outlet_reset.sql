-- Public demo reset (operator-approved production exception; see AGENTS.md "Public demo exception").
-- Restores the single fixed demo outlet to a caller-supplied baseline. The function is hardcoded to
-- demo-outlet/org-demo-outlet/menu-demo-outlet, refuses to run unless the outlet is flagged
-- is_demo_data, and never touches the immutable POS ledger, audit trail, AI spend accounting,
-- identity, entitlements or billing tables. Forward-only; no existing object is altered.
CREATE TABLE IF NOT EXISTS app_private.demo_reset_runs(
  id bigserial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  summary jsonb NOT NULL
);
REVOKE ALL ON app_private.demo_reset_runs FROM PUBLIC;

CREATE OR REPLACE FUNCTION app_private.reset_demo_outlet(p_baseline jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  o CONSTANT text := 'demo-outlet';
  org CONSTANT text := 'org-demo-outlet';
  mid CONSTANT text := 'menu-demo-outlet';
  rev integer;
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
