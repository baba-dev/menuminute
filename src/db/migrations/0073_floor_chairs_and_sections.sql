-- Dining floor v2: real chairs, named/numbered tables and first-class sections.
-- Forward-only and additive. No customer data is deleted:
--   * legacy numbered tables keep working for QR codes, orders and POS, but are renamed out of the
--     way and are not shown on the new floor (they have no display_number);
--   * restaurant_tables.capacity becomes a value maintained from active chairs;
--   * dining_floor_plans (the old drag-canvas JSON) is left in place and is simply no longer read.
-- Rollback: stop using the new columns/tables; the previous release ignores them.

-- ─── Sections ────────────────────────────────────────────────────────────────
CREATE TABLE dining_sections (
  id text PRIMARY KEY,
  outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 64 AND name = btrim(name)),
  color text NOT NULL DEFAULT '#f59e0b' CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, outlet_id)
);
CREATE UNIQUE INDEX dining_sections_outlet_name_uq ON dining_sections (outlet_id, lower(name));

-- ─── Tables: name, human number, section ─────────────────────────────────────
ALTER TABLE restaurant_tables
  ADD COLUMN name text CHECK (name IS NULL OR char_length(name) BETWEEN 1 AND 80),
  ADD COLUMN display_number integer CHECK (display_number IS NULL OR display_number BETWEEN 1 AND 9999),
  ADD COLUMN section_id text,
  ADD COLUMN shape text NOT NULL DEFAULT 'rectangle'
    CHECK (shape IN ('round','square','rectangle','booth'));

-- Legacy numeric table numbers would collide with numbers the floor now assigns. Rename them
-- (reversible: the original number is embedded). Their label, QR codes and orders are untouched.
UPDATE restaurant_tables
   SET table_number = 'legacy-' || table_number || '-' || left(id, 8)
 WHERE table_number ~ '^[0-9]{1,6}$';

-- An archived table must free its number for reuse.
DROP INDEX IF EXISTS tables_number_idx;
CREATE UNIQUE INDEX tables_number_idx ON restaurant_tables (restaurant_id, table_number) WHERE is_active;
CREATE UNIQUE INDEX tables_display_number_idx ON restaurant_tables (restaurant_id, display_number)
  WHERE is_active AND display_number IS NOT NULL;
CREATE UNIQUE INDEX tables_id_outlet_uq ON restaurant_tables (id, restaurant_id);
ALTER TABLE restaurant_tables
  ADD CONSTRAINT restaurant_tables_section_fk FOREIGN KEY (section_id, restaurant_id)
  REFERENCES dining_sections (id, outlet_id) ON DELETE SET NULL (section_id);

-- ─── Chairs ──────────────────────────────────────────────────────────────────
CREATE TABLE restaurant_chairs (
  id text PRIMARY KEY,
  outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id text,
  label text CHECK (label IS NULL OR char_length(label) BETWEEN 1 AND 40),
  kind text NOT NULL DEFAULT 'standard'
    CHECK (kind IN ('standard','high_chair','bar_stool','accessible')),
  is_active boolean NOT NULL DEFAULT true,
  occupied_at timestamptz,
  occupied_by text REFERENCES users(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (table_id, outlet_id) REFERENCES restaurant_tables (id, restaurant_id) ON DELETE CASCADE,
  CHECK (occupied_at IS NULL OR (table_id IS NOT NULL AND is_active))
);
CREATE INDEX restaurant_chairs_table_idx ON restaurant_chairs (outlet_id, table_id) WHERE is_active;

-- Moving, unassigning or retiring a chair always frees it, so occupancy can never leak between tables.
CREATE FUNCTION app_private.restaurant_chairs_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n integer;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.outlet_id IS DISTINCT FROM OLD.outlet_id THEN
      RAISE EXCEPTION 'A chair cannot change outlet' USING ERRCODE='22023';
    END IF;
    IF NEW.table_id IS DISTINCT FROM OLD.table_id OR NOT NEW.is_active THEN
      IF OLD.occupied_at IS NOT NULL THEN
        NEW.occupied_at := NULL; NEW.occupied_by := NULL; NEW.version := OLD.version + 1;
      END IF;
    END IF;
  END IF;
  IF NEW.is_active AND NEW.table_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.table_id IS DISTINCT FROM OLD.table_id OR NOT OLD.is_active) THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.outlet_id, 87315));
    SELECT count(*) INTO n FROM restaurant_chairs
     WHERE outlet_id = NEW.outlet_id AND table_id = NEW.table_id AND is_active AND id <> NEW.id;
    IF n >= 30 THEN
      RAISE EXCEPTION 'A table can seat at most 30 chairs' USING ERRCODE='22023';
    END IF;
    SELECT count(*) INTO n FROM restaurant_chairs WHERE outlet_id = NEW.outlet_id AND id <> NEW.id;
    IF n >= 1500 THEN
      RAISE EXCEPTION 'Outlet chair limit reached' USING ERRCODE='22023';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restaurant_chairs_guard BEFORE INSERT OR UPDATE ON restaurant_chairs
  FOR EACH ROW EXECUTE FUNCTION app_private.restaurant_chairs_guard();

-- restaurant_tables.capacity is now derived from active chairs (bookings and reports read it).
CREATE FUNCTION app_private.restaurant_chairs_capacity() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE t text;
BEGIN
  FOR t IN SELECT DISTINCT x FROM unnest(ARRAY[
    CASE WHEN TG_OP <> 'INSERT' THEN OLD.table_id END,
    CASE WHEN TG_OP <> 'DELETE' THEN NEW.table_id END]) AS x WHERE x IS NOT NULL LOOP
    UPDATE restaurant_tables SET capacity = (
      SELECT count(*)::integer FROM restaurant_chairs c
       WHERE c.table_id = t AND c.is_active)
     WHERE id = t;
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER restaurant_chairs_capacity
  AFTER INSERT OR DELETE OR UPDATE OF table_id, is_active ON restaurant_chairs
  FOR EACH ROW EXECUTE FUNCTION app_private.restaurant_chairs_capacity();

-- ─── Defaults for tables created by older paths (onboarding, demo reset) ─────
-- Numbered tables made by onboarding get a display number and name; QR "service point" tables
-- (UUID numbers) stay off the floor. Demo outlets get sections and chairs so the public demo works.
CREATE FUNCTION app_private.restaurant_tables_defaults() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NEW.name IS NULL AND NEW.label IS NOT NULL THEN NEW.name := left(NEW.label, 80); END IF;
  IF NEW.display_number IS NULL AND NEW.is_active AND NEW.table_number ~ '^[0-9]{1,4}$'
     AND NEW.table_number::integer BETWEEN 1 AND 9999 THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.restaurant_id, 87316));
    IF EXISTS(SELECT 1 FROM restaurant_tables WHERE restaurant_id = NEW.restaurant_id
                AND is_active AND display_number = NEW.table_number::integer) THEN
      SELECT COALESCE(max(display_number), 0) + 1 INTO NEW.display_number
        FROM restaurant_tables WHERE restaurant_id = NEW.restaurant_id AND is_active;
    ELSE
      NEW.display_number := NEW.table_number::integer;
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER restaurant_tables_defaults BEFORE INSERT ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION app_private.restaurant_tables_defaults();

CREATE FUNCTION app_private.restaurant_tables_demo_seed() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE sec text; shp text; i integer;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM restaurants WHERE id = NEW.restaurant_id AND is_demo_data) THEN
    RETURN NULL;
  END IF;
  INSERT INTO dining_sections(id, outlet_id, name, color, sort_order) VALUES
    ('demo-section-main',    NEW.restaurant_id, 'Main Dining',    '#f59e0b', 0),
    ('demo-section-window',  NEW.restaurant_id, 'Window Room',    '#06b6d4', 1),
    ('demo-section-counter', NEW.restaurant_id, 'Chef''s Counter', '#8b5cf6', 2),
    ('demo-section-terrace', NEW.restaurant_id, 'Garden Terrace', '#10b981', 3),
    ('demo-section-private', NEW.restaurant_id, 'Private Dining', '#ec4899', 4)
  ON CONFLICT DO NOTHING;
  sec := CASE NEW.id
    WHEN 'demo-table-9'  THEN 'demo-section-window'
    WHEN 'demo-table-10' THEN 'demo-section-counter'
    WHEN 'demo-table-11' THEN 'demo-section-terrace'
    WHEN 'demo-table-12' THEN 'demo-section-private'
    ELSE 'demo-section-main' END;
  shp := CASE NEW.id
    WHEN 'demo-table-1' THEN 'round' WHEN 'demo-table-2' THEN 'round'
    WHEN 'demo-table-3' THEN 'round' WHEN 'demo-table-4' THEN 'round'
    WHEN 'demo-table-5' THEN 'square' WHEN 'demo-table-6' THEN 'square'
    WHEN 'demo-table-7' THEN 'square' WHEN 'demo-table-8' THEN 'square'
    WHEN 'demo-table-9' THEN 'booth'
    ELSE 'rectangle' END;
  UPDATE restaurant_tables SET section_id = sec, shape = shp WHERE id = NEW.id;
  FOR i IN 1..LEAST(COALESCE(NEW.capacity, 0), 30) LOOP
    INSERT INTO restaurant_chairs(id, outlet_id, table_id, label)
    VALUES (NEW.id || '-c' || i, NEW.restaurant_id, NEW.id, 'Chair ' || i);
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER restaurant_tables_demo_seed AFTER INSERT ON restaurant_tables
  FOR EACH ROW EXECUTE FUNCTION app_private.restaurant_tables_demo_seed();

-- ─── Occupancy commands (one tap for floor staff; no structural rights needed) ──
CREATE FUNCTION app_private.floor_set_chair_occupied(
  p_outlet text, p_chair text, p_occupied boolean, p_expected_version integer
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE c restaurant_chairs%ROWTYPE; v_actor text := nullif(current_setting('app.actor_id',true),'');
BEGIN
  IF v_actor IS NULL OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
     OR NOT app_private.can_outlet(p_outlet,'orders.accept') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  SELECT * INTO c FROM restaurant_chairs
   WHERE id = p_chair AND outlet_id = p_outlet AND is_active AND table_id IS NOT NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assigned chair required' USING ERRCODE='22023'; END IF;
  -- Idempotent: a repeated tap that already matches the requested state never conflicts.
  IF (c.occupied_at IS NOT NULL) = p_occupied THEN
    RETURN jsonb_build_object('id',c.id,'occupied',p_occupied,'version',c.version);
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> c.version THEN
    RAISE EXCEPTION 'Chair changed elsewhere' USING ERRCODE='40001';
  END IF;
  UPDATE restaurant_chairs SET
    occupied_at = CASE WHEN p_occupied THEN now() END,
    occupied_by = CASE WHEN p_occupied THEN v_actor END,
    version = version + 1
   WHERE id = c.id RETURNING * INTO c;
  RETURN jsonb_build_object('id',c.id,'occupied',p_occupied,'version',c.version);
END $$;
REVOKE ALL ON FUNCTION app_private.floor_set_chair_occupied(text,text,boolean,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.floor_set_chair_occupied(text,text,boolean,integer) TO menuminute_app;

-- Seat a party: occupy up to p_count free chairs (all free chairs when NULL). Returns chairs seated.
CREATE FUNCTION app_private.floor_seat_table(p_outlet text, p_table text, p_count integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_actor text := nullif(current_setting('app.actor_id',true),''); n integer;
BEGIN
  IF v_actor IS NULL OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
     OR NOT app_private.can_outlet(p_outlet,'orders.accept') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF p_count IS NOT NULL AND p_count < 1 THEN
    RAISE EXCEPTION 'Seat at least one guest' USING ERRCODE='22023';
  END IF;
  PERFORM 1 FROM restaurant_tables WHERE id = p_table AND restaurant_id = p_outlet AND is_active;
  IF NOT FOUND THEN RAISE EXCEPTION 'Active outlet table required' USING ERRCODE='22023'; END IF;
  WITH pick AS (
    SELECT id FROM restaurant_chairs
     WHERE outlet_id = p_outlet AND table_id = p_table AND is_active AND occupied_at IS NULL
     ORDER BY created_at, id LIMIT COALESCE(p_count, 30) FOR UPDATE)
  UPDATE restaurant_chairs c SET occupied_at = now(), occupied_by = v_actor, version = c.version + 1
    FROM pick WHERE c.id = pick.id;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.floor_seat_table(text,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.floor_seat_table(text,text,integer) TO menuminute_app;

CREATE FUNCTION app_private.floor_clear_table(p_outlet text, p_table text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n integer;
BEGIN
  IF nullif(current_setting('app.actor_id',true),'') IS NULL
     OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
     OR NOT app_private.can_outlet(p_outlet,'orders.accept') THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM restaurant_tables WHERE id = p_table AND restaurant_id = p_outlet;
  IF NOT FOUND THEN RAISE EXCEPTION 'Outlet table required' USING ERRCODE='22023'; END IF;
  UPDATE restaurant_chairs SET occupied_at = NULL, occupied_by = NULL, version = version + 1
   WHERE outlet_id = p_outlet AND table_id = p_table AND occupied_at IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.floor_clear_table(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.floor_clear_table(text,text) TO menuminute_app;

-- ─── Row-level security and grants (structure needs menu.write; reads need orders.read) ──
ALTER TABLE dining_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_chairs ENABLE ROW LEVEL SECURITY;

CREATE POLICY dining_sections_app_read ON dining_sections FOR SELECT TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'orders.read'));
CREATE POLICY dining_sections_app_insert ON dining_sections FOR INSERT TO menuminute_app
 WITH CHECK (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY dining_sections_app_update ON dining_sections FOR UPDATE TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'))
 WITH CHECK (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY dining_sections_app_delete ON dining_sections FOR DELETE TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY dining_sections_owner ON dining_sections FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);

CREATE POLICY restaurant_chairs_app_read ON restaurant_chairs FOR SELECT TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'orders.read'));
CREATE POLICY restaurant_chairs_app_insert ON restaurant_chairs FOR INSERT TO menuminute_app
 WITH CHECK (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY restaurant_chairs_app_update ON restaurant_chairs FOR UPDATE TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'))
 WITH CHECK (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'));
-- A guest-occupied chair must be freed before it can be removed.
CREATE POLICY restaurant_chairs_app_delete ON restaurant_chairs FOR DELETE TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write')
   AND occupied_at IS NULL);
CREATE POLICY restaurant_chairs_owner ON restaurant_chairs FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);

GRANT SELECT, DELETE ON dining_sections, restaurant_chairs TO menuminute_app;
GRANT INSERT (id, outlet_id, name, color, sort_order, created_at) ON dining_sections TO menuminute_app;
GRANT UPDATE (name, color, sort_order) ON dining_sections TO menuminute_app;
-- Occupancy columns are deliberately not writable here; only the floor_* commands change them.
GRANT INSERT (id, outlet_id, table_id, label, kind, is_active) ON restaurant_chairs TO menuminute_app;
GRANT UPDATE (table_id, label, kind, is_active) ON restaurant_chairs TO menuminute_app;
GRANT INSERT (name, display_number, section_id, shape) ON restaurant_tables TO menuminute_app;
GRANT UPDATE (name, display_number, section_id, shape) ON restaurant_tables TO menuminute_app;
