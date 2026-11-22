-- 0114: Tiffin & Home-Chef Hub phase 1 foundation (ADR 032). Additive only: widens outlet_type_valid
-- to allow 'tiffin' and creates the outlet-scoped planning tables (slots, week menus, date overrides,
-- combos with items and add-ons, delivery areas). Existing outlet rows, fulfillment_valid,
-- pickup_only_types, orders, menus and checkout are untouched.
-- Isolation: every table carries organization_id; outlet references are composite
-- (organization_id,outlet_id) -> restaurants(organization_id,id) and child references are composite
-- (organization_id,outlet_id,parent_id), so neither cross-tenant nor cross-outlet links can exist.
-- RLS is enabled and all direct access is revoked from PUBLIC, menuminute_app and menuminute_worker
-- (the 0085 crm_guests pattern); later phases expose reviewed SECURITY DEFINER functions only.
-- Money is bigint minor units bounded to 0..2147483647. CHECKs mirror src/modules/tiffin/contracts.ts.
-- Rollback: phase 1 never writes these tables in production (TIFFIN_ENABLED defaults false and no code
-- path inserts rows). DROP the tiffin_* tables only after confirming each is empty (children first:
-- tiffin_date_override_combos, tiffin_week_menu_combos, tiffin_combo_addons, tiffin_combo_items,
-- tiffin_date_overrides, tiffin_week_menus, tiffin_combos, tiffin_slots, tiffin_areas). Re-narrow
-- outlet_type_valid to the 0001 list only after confirming no restaurants row has outlet_type='tiffin'.

ALTER TABLE restaurants DROP CONSTRAINT outlet_type_valid;
ALTER TABLE restaurants ADD CONSTRAINT outlet_type_valid
  CHECK (outlet_type IN ('restaurant','cafe','takeout','cloud_kitchen','hotel','mixed','tiffin'));

CREATE TABLE tiffin_slots (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  kind text NOT NULL CONSTRAINT tiffin_slots_kind_check CHECK (kind IN ('lunch','dinner')),
  start_minute integer NOT NULL CONSTRAINT tiffin_slots_start_minute_check CHECK (start_minute BETWEEN 0 AND 1439),
  end_minute integer NOT NULL CONSTRAINT tiffin_slots_end_minute_check CHECK (end_minute BETWEEN 1 AND 1440),
  cutoff_minutes_before integer NOT NULL
    CONSTRAINT tiffin_slots_cutoff_check CHECK (cutoff_minutes_before BETWEEN 0 AND 10080),
  capacity integer CONSTRAINT tiffin_slots_capacity_check CHECK (capacity IS NULL OR capacity >= 1),
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_slots_window_check CHECK (end_minute > start_minute),
  CONSTRAINT tiffin_slots_outlet_kind_key UNIQUE (outlet_id,kind),
  CONSTRAINT tiffin_slots_org_id_key UNIQUE (organization_id,id),
  CONSTRAINT tiffin_slots_org_outlet_id_key UNIQUE (organization_id,outlet_id,id),
  CONSTRAINT tiffin_slots_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id)
);

CREATE TABLE tiffin_combos (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  name text NOT NULL CONSTRAINT tiffin_combos_name_check CHECK (length(btrim(name)) >= 1 AND length(name) <= 80),
  description text NOT NULL DEFAULT '' CONSTRAINT tiffin_combos_description_check CHECK (length(description) <= 300),
  price_minor bigint NOT NULL
    CONSTRAINT tiffin_combos_price_minor_check CHECK (price_minor BETWEEN 0 AND 2147483647),
  currency text NOT NULL CONSTRAINT tiffin_combos_currency_check CHECK (currency ~ '^[A-Z]{3}$'),
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_combos_org_id_key UNIQUE (organization_id,id),
  CONSTRAINT tiffin_combos_org_outlet_id_key UNIQUE (organization_id,outlet_id,id),
  CONSTRAINT tiffin_combos_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id)
);
CREATE INDEX tiffin_combos_outlet_idx ON tiffin_combos(outlet_id,archived);

CREATE TABLE tiffin_combo_items (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  combo_id text NOT NULL,
  label text NOT NULL CONSTRAINT tiffin_combo_items_label_check CHECK (length(btrim(label)) >= 1 AND length(label) <= 80),
  quantity integer NOT NULL CONSTRAINT tiffin_combo_items_quantity_check CHECK (quantity BETWEEN 1 AND 99),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_combo_items_org_id_key UNIQUE (organization_id,id),
  CONSTRAINT tiffin_combo_items_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id),
  CONSTRAINT tiffin_combo_items_combo_fkey FOREIGN KEY (organization_id,outlet_id,combo_id)
    REFERENCES tiffin_combos(organization_id,outlet_id,id) ON DELETE CASCADE
);
CREATE INDEX tiffin_combo_items_combo_idx ON tiffin_combo_items(combo_id);

CREATE TABLE tiffin_combo_addons (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  combo_id text NOT NULL,
  label text NOT NULL CONSTRAINT tiffin_combo_addons_label_check CHECK (length(btrim(label)) >= 1 AND length(label) <= 80),
  price_minor bigint NOT NULL
    CONSTRAINT tiffin_combo_addons_price_minor_check CHECK (price_minor BETWEEN 0 AND 2147483647),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_combo_addons_org_id_key UNIQUE (organization_id,id),
  CONSTRAINT tiffin_combo_addons_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id),
  CONSTRAINT tiffin_combo_addons_combo_fkey FOREIGN KEY (organization_id,outlet_id,combo_id)
    REFERENCES tiffin_combos(organization_id,outlet_id,id) ON DELETE CASCADE
);
CREATE INDEX tiffin_combo_addons_combo_idx ON tiffin_combo_addons(combo_id);

CREATE TABLE tiffin_week_menus (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  slot_id text NOT NULL,
  weekday smallint NOT NULL CONSTRAINT tiffin_week_menus_weekday_check CHECK (weekday BETWEEN 0 AND 6),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_week_menus_slot_weekday_key UNIQUE (slot_id,weekday),
  CONSTRAINT tiffin_week_menus_org_id_key UNIQUE (organization_id,id),
  CONSTRAINT tiffin_week_menus_org_outlet_id_key UNIQUE (organization_id,outlet_id,id),
  CONSTRAINT tiffin_week_menus_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id),
  CONSTRAINT tiffin_week_menus_slot_fkey FOREIGN KEY (organization_id,outlet_id,slot_id)
    REFERENCES tiffin_slots(organization_id,outlet_id,id) ON DELETE CASCADE
);

CREATE TABLE tiffin_week_menu_combos (
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  week_menu_id text NOT NULL,
  combo_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
    CONSTRAINT tiffin_week_menu_combos_sort_order_check CHECK (sort_order BETWEEN 0 AND 999),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_week_menu_combos_pkey PRIMARY KEY (week_menu_id,combo_id),
  CONSTRAINT tiffin_week_menu_combos_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id),
  CONSTRAINT tiffin_week_menu_combos_menu_fkey FOREIGN KEY (organization_id,outlet_id,week_menu_id)
    REFERENCES tiffin_week_menus(organization_id,outlet_id,id) ON DELETE CASCADE,
  CONSTRAINT tiffin_week_menu_combos_combo_fkey FOREIGN KEY (organization_id,outlet_id,combo_id)
    REFERENCES tiffin_combos(organization_id,outlet_id,id) ON DELETE CASCADE
);
CREATE INDEX tiffin_week_menu_combos_combo_idx ON tiffin_week_menu_combos(combo_id);

CREATE TABLE tiffin_date_overrides (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  slot_id text NOT NULL,
  local_date date NOT NULL,
  closed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_date_overrides_slot_date_key UNIQUE (slot_id,local_date),
  CONSTRAINT tiffin_date_overrides_org_id_key UNIQUE (organization_id,id),
  CONSTRAINT tiffin_date_overrides_org_outlet_id_key UNIQUE (organization_id,outlet_id,id),
  CONSTRAINT tiffin_date_overrides_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id),
  CONSTRAINT tiffin_date_overrides_slot_fkey FOREIGN KEY (organization_id,outlet_id,slot_id)
    REFERENCES tiffin_slots(organization_id,outlet_id,id) ON DELETE CASCADE
);

CREATE TABLE tiffin_date_override_combos (
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  override_id text NOT NULL,
  combo_id text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0
    CONSTRAINT tiffin_date_override_combos_sort_order_check CHECK (sort_order BETWEEN 0 AND 999),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_date_override_combos_pkey PRIMARY KEY (override_id,combo_id),
  CONSTRAINT tiffin_date_override_combos_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id),
  CONSTRAINT tiffin_date_override_combos_override_fkey FOREIGN KEY (organization_id,outlet_id,override_id)
    REFERENCES tiffin_date_overrides(organization_id,outlet_id,id) ON DELETE CASCADE,
  CONSTRAINT tiffin_date_override_combos_combo_fkey FOREIGN KEY (organization_id,outlet_id,combo_id)
    REFERENCES tiffin_combos(organization_id,outlet_id,id) ON DELETE CASCADE
);
CREATE INDEX tiffin_date_override_combos_combo_idx ON tiffin_date_override_combos(combo_id);

CREATE TABLE tiffin_areas (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  outlet_id text NOT NULL,
  name text NOT NULL CONSTRAINT tiffin_areas_name_check CHECK (length(btrim(name)) >= 1 AND length(name) <= 60),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT tiffin_areas_org_id_key UNIQUE (organization_id,id),
  CONSTRAINT tiffin_areas_outlet_fkey FOREIGN KEY (organization_id,outlet_id)
    REFERENCES restaurants(organization_id,id)
);
CREATE UNIQUE INDEX tiffin_areas_outlet_name_key ON tiffin_areas(outlet_id,lower(name));

ALTER TABLE tiffin_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_combo_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_combo_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_week_menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_week_menu_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_date_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_date_override_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE tiffin_areas ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON tiffin_slots,tiffin_combos,tiffin_combo_items,tiffin_combo_addons,tiffin_week_menus,
  tiffin_week_menu_combos,tiffin_date_overrides,tiffin_date_override_combos,tiffin_areas
  FROM PUBLIC,menuminute_app,menuminute_worker;
