-- Migration 0032: Razorpay Billing Webhook Grant Function & Subscription Plans Seeding

CREATE OR REPLACE FUNCTION app_private.record_razorpay_grant(
  p_org text,
  p_capability text,
  p_currency text,
  p_starts timestamptz,
  p_ends timestamptz,
  p_operator text,
  p_reason text,
  p_key text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  v_grant_id text := gen_random_uuid()::text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = p_org) THEN
    RAISE EXCEPTION 'Unknown organization' USING ERRCODE = '22023';
  END IF;
  IF p_capability NOT IN ('ordering.new', 'kitchen.new') THEN
    RAISE EXCEPTION 'Invalid capability' USING ERRCODE = '22023';
  END IF;
  IF p_currency NOT IN ('INR', 'USD') THEN
    RAISE EXCEPTION 'Invalid billing currency' USING ERRCODE = '22023';
  END IF;
  IF p_ends <= p_starts THEN
    RAISE EXCEPTION 'Invalid grant window' USING ERRCODE = '22023';
  END IF;

  -- Idempotency check: if grant with request_key already exists, return existing ID
  IF EXISTS (SELECT 1 FROM entitlement_grants WHERE request_key = p_key) THEN
    RETURN (SELECT id FROM entitlement_grants WHERE request_key = p_key);
  END IF;

  INSERT INTO entitlement_grants (
    id, organization_id, capability, billing_currency, starts_at, ends_at, operator, reason, request_key
  ) VALUES (
    v_grant_id, p_org, p_capability, p_currency, p_starts, p_ends, p_operator, p_reason, p_key
  );

  RETURN v_grant_id;
END;
$$;

REVOKE ALL ON FUNCTION app_private.record_razorpay_grant(text,text,text,timestamptz,timestamptz,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.record_razorpay_grant(text,text,text,timestamptz,timestamptz,text,text,text) TO menuminute_app;

-- Seed canonical subscription plans with approved minor unit pricing in paise
INSERT INTO subscription_plans (id, name, display_name, monthly_price_paise, features, is_active, sort_order)
VALUES
  ('plan_free', 'free', 'Free Forever', 0, '["qr_menu","unlimited_dishes","ai_paper_scan","sold_out_86"]', true, 1),
  ('plan_ordering', 'ordering', 'Live Table Ordering', 11900, '["table_ordering","cart_checkout","service_counter","order_tracking"]', true, 2),
  ('plan_kitchen_pro', 'kitchen_pro', 'Kitchen Pro KDS', 29900, '["live_kds","audio_chimes","station_routing","pos_till"]', true, 3)
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  monthly_price_paise = EXCLUDED.monthly_price_paise,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;
