-- Custom migration: 0006_online_ordering.sql
-- Implements canonical online ordering columns, constraints, and daily sequence generator

ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "fulfillment_mode" text NOT NULL DEFAULT 'dine_in';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_status" text NOT NULL DEFAULT 'unpaid';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'INR';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotal_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tax_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "total_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "rejection_reason" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "client_submission_key" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "tracking_token" text;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "expires_at" timestamp with time zone;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "version" integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "orders_submission_key_idx" ON "orders" ("restaurant_id", "client_submission_key") WHERE "client_submission_key" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_tracking_token_idx" ON "orders" ("tracking_token") WHERE "tracking_token" IS NOT NULL;

ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "dish_id" text NOT NULL DEFAULT '';
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "selected_options" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "unit_price_minor" integer NOT NULL DEFAULT 0;
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "total_minor" integer NOT NULL DEFAULT 0;

ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "from_status" text;
ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "to_status" text NOT NULL DEFAULT 'pending';
ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "actor_type" text NOT NULL DEFAULT 'system';
ALTER TABLE "order_status_events" ADD COLUMN IF NOT EXISTS "actor_id" text;

-- Daily scoped sequence counter table in app_private schema
CREATE TABLE IF NOT EXISTS app_private.order_counters (
  restaurant_id text NOT NULL,
  business_date date NOT NULL,
  last_order_number integer NOT NULL DEFAULT 0,
  PRIMARY KEY (restaurant_id, business_date)
);

CREATE OR REPLACE FUNCTION app_private.next_order_number(p_restaurant_id text, p_business_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_num integer;
BEGIN
  INSERT INTO app_private.order_counters(restaurant_id, business_date, last_order_number)
  VALUES(p_restaurant_id, p_business_date, 1)
  ON CONFLICT (restaurant_id, business_date)
  DO UPDATE SET last_order_number = app_private.order_counters.last_order_number + 1
  RETURNING last_order_number INTO v_num;
  RETURN v_num;
END $$;

REVOKE ALL ON FUNCTION app_private.next_order_number(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.next_order_number(text, date) TO menuminute_app;
