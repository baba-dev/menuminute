-- Live table signals, slice 1: optional per-outlet settings and the append-only signal ledger.
-- Forward-only and additive. Nothing is deleted or rewritten.
-- Default OFF: an outlet that never enables it sees no change. No producer writes the ledger yet
-- (QR scan, water, order, kitchen and POS producers arrive in later slices).
-- Rollback: stop reading the tables; the previous release ignores them.

CREATE TABLE floor_signal_settings (
  outlet_id text PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  qr_scan_pings boolean NOT NULL DEFAULT true,
  guest_water_button boolean NOT NULL DEFAULT true,
  show_kitchen boolean NOT NULL DEFAULT true,
  show_pos_bill boolean NOT NULL DEFAULT true,
  revision integer NOT NULL DEFAULT 1,
  updated_by text REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE table_signal_events (
  id text PRIMARY KEY,
  outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN (
    'qr_scanned','water_requested','water_acknowledged','water_served',
    'order_placed','order_accepted','kitchen_preparing','kitchen_ready','order_served',
    'bill_requested','bill_presented','paid')),
  source text NOT NULL CHECK (source IN ('guest','orders','kitchen','pos','staff')),
  ref_id text,
  -- Idempotent producers: the same business fact can be recorded at most once per outlet.
  dedupe_key text NOT NULL CHECK (char_length(dedupe_key) BETWEEN 1 AND 200),
  -- Small, non-personal facts only (e.g. dish count). Never phone numbers or names.
  meta jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (pg_column_size(meta) <= 512),
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (table_id, outlet_id) REFERENCES restaurant_tables (id, restaurant_id) ON DELETE CASCADE,
  UNIQUE (outlet_id, dedupe_key)
);
CREATE INDEX table_signal_events_recent ON table_signal_events (outlet_id, table_id, occurred_at DESC);
CREATE INDEX table_signal_events_prune ON table_signal_events (occurred_at);

ALTER TABLE floor_signal_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE table_signal_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON floor_signal_settings, table_signal_events FROM PUBLIC, menuminute_app, menuminute_worker;

CREATE POLICY floor_signal_settings_app_read ON floor_signal_settings FOR SELECT TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'orders.read'));
CREATE POLICY floor_signal_settings_app_insert ON floor_signal_settings FOR INSERT TO menuminute_app
 WITH CHECK (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY floor_signal_settings_app_update ON floor_signal_settings FOR UPDATE TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'))
 WITH CHECK (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'menu.write'));
CREATE POLICY floor_signal_settings_owner ON floor_signal_settings FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);

-- Staff may only read the ledger; producers are added later as narrow SECURITY DEFINER functions.
CREATE POLICY table_signal_events_app_read ON table_signal_events FOR SELECT TO menuminute_app
 USING (outlet_id=current_setting('app.outlet_id',true) AND app_private.can_outlet(outlet_id,'orders.read'));
CREATE POLICY table_signal_events_owner ON table_signal_events FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);

GRANT SELECT ON floor_signal_settings, table_signal_events TO menuminute_app;
GRANT INSERT (outlet_id, enabled, qr_scan_pings, guest_water_button, show_kitchen, show_pos_bill, updated_by)
  ON floor_signal_settings TO menuminute_app;
GRANT UPDATE (enabled, qr_scan_pings, guest_water_button, show_kitchen, show_pos_bill, revision, updated_by, updated_at)
  ON floor_signal_settings TO menuminute_app;
