-- Migration 0028: Shop Geocoordinates and Super Onboarding Provisioning
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS latitude numeric(10, 7),
  ADD COLUMN IF NOT EXISTS longitude numeric(10, 7);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_latitude_range_chk'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_latitude_range_chk
      CHECK (latitude IS NULL OR (latitude >= -90.0 AND latitude <= 90.0));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'restaurants_longitude_range_chk'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_longitude_range_chk
      CHECK (longitude IS NULL OR (longitude >= -180.0 AND longitude <= 180.0));
  END IF;
END $$;

-- Update app_private.provision_organization to persist physical address, geocoordinates,
-- contact, branding, and optional initial Dine-In table seats.
CREATE OR REPLACE FUNCTION app_private.provision_organization(outlet text, token text, request_input jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  actor text := current_setting('app.actor_id', true);
  org text := 'org-' || outlet;
BEGIN
  IF actor IS NULL OR NOT EXISTS(SELECT 1 FROM users WHERE id = actor) THEN
    RAISE EXCEPTION 'Unknown actor';
  END IF;
  IF length(token) < 12 OR length(request_input->>'name') NOT BETWEEN 2 AND 100 THEN
    RAISE EXCEPTION 'Invalid provisioning input';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(outlet, 0));

  -- Serialize verified owner before checking new-account quota
  PERFORM 1 FROM users WHERE id = actor AND email_verified FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Verified account required' USING ERRCODE = '42501';
  END IF;

  IF EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id = outlet) THEN
    IF NOT EXISTS(SELECT 1 FROM app_private.provisioning_requests p WHERE p.outlet_id = outlet AND p.actor_id = actor AND p.input = (request_input - 'svgData')) THEN
      RAISE EXCEPTION 'Provisioning key conflict';
    END IF;
    RETURN;
  END IF;

  IF (SELECT count(*) FROM organization_members WHERE user_id = actor AND role = 'owner' AND is_active) >= 3 THEN
    RAISE EXCEPTION 'New account organization limit reached' USING ERRCODE = 'P3001';
  END IF;

  INSERT INTO organizations(id, name) VALUES (org, request_input->>'name');
  INSERT INTO organization_members(id, organization_id, user_id, role) VALUES ('member-' || outlet, org, actor, 'owner');

  INSERT INTO restaurants(
    id, organization_id, public_id, name, slug, description,
    address_line1, address_line2, city, state, postal_code, country,
    latitude, longitude, phone, email, website,
    primary_color, secondary_color, currency, timezone, outlet_type, fulfillment_modes,
    pickup_lead_minutes, pickup_slot_minutes, pickup_advance_days
  )
  VALUES (
    outlet,
    org,
    token,
    request_input->>'name',
    outlet,
    request_input->>'description',
    NULLIF(trim(request_input->>'addressLine1'), ''),
    NULLIF(trim(request_input->>'addressLine2'), ''),
    NULLIF(trim(request_input->>'city'), ''),
    NULLIF(trim(request_input->>'state'), ''),
    NULLIF(trim(request_input->>'postalCode'), ''),
    COALESCE(request_input->>'country', 'IN'),
    CASE WHEN (request_input->>'latitude') IS NOT NULL AND (request_input->>'latitude') <> ''
         THEN (request_input->>'latitude')::numeric(10, 7) ELSE NULL END,
    CASE WHEN (request_input->>'longitude') IS NOT NULL AND (request_input->>'longitude') <> ''
         THEN (request_input->>'longitude')::numeric(10, 7) ELSE NULL END,
    NULLIF(trim(request_input->>'phone'), ''),
    lower(NULLIF(trim(request_input->>'email'), '')),
    NULLIF(trim(request_input->>'website'), ''),
    COALESCE(request_input->>'primaryColor', '#f97316'),
    COALESCE(request_input->>'secondaryColor', '#1c1917'),
    COALESCE(request_input->>'currency', 'INR'),
    COALESCE(request_input->>'timezone', 'Asia/Kolkata'),
    COALESCE(request_input->>'outletType', 'restaurant'),
    COALESCE((SELECT array_agg(value) FROM jsonb_array_elements_text(request_input->'fulfillmentModes')),
      CASE WHEN request_input->>'outletType' IN ('cafe','takeout','cloud_kitchen') THEN ARRAY['pickup']::text[] ELSE ARRAY['dine_in']::text[] END),
    COALESCE((request_input->>'pickupLeadMinutes')::integer, 15),
    COALESCE((request_input->>'pickupSlotMinutes')::integer, 15),
    COALESCE((request_input->>'pickupAdvanceDays')::integer, 7)
  );

  INSERT INTO app_private.provisioning_requests(outlet_id, actor_id, input)
  VALUES (outlet, actor, request_input - 'svgData');

  INSERT INTO brands(id, organization_id, name) VALUES ('brand-' || outlet, org, request_input->>'name');
  INSERT INTO brand_outlets(organization_id, brand_id, outlet_id) VALUES (org, 'brand-' || outlet, outlet);

  INSERT INTO qr_codes(id, restaurant_id, destination_token, svg_data, label)
  VALUES ('qr-' || outlet, outlet, token, request_input->>'svgData', 'Main Menu QR');

  -- Initial Dine-In tables generation if requested
  IF (request_input->>'tableCount') IS NOT NULL AND (request_input->>'tableCount')::integer > 0 THEN
    FOR i IN 1..LEAST((request_input->>'tableCount')::integer, 50) LOOP
      INSERT INTO restaurant_tables(id, restaurant_id, table_number, label, is_active)
      VALUES (gen_random_uuid()::text, outlet, i::text, 'Table ' || i, true);
    END LOOP;
  END IF;

  INSERT INTO menus(id, organization_id, outlet_id, document)
  VALUES (
    'menu-' || outlet,
    org,
    outlet,
    jsonb_build_object(
      'name', 'Our menu',
      'currency', COALESCE(request_input->>'currency', 'INR'),
      'schedule', COALESCE(request_input->'menuSchedule', 'null'::jsonb),
      'categories', '[]'::jsonb
    )
  );

  INSERT INTO menu_assignments(organization_id, menu_id, outlet_id)
  VALUES (org, 'menu-' || outlet, outlet);

  PERFORM app_private.record_org_change(org, 'organization.created', outlet);
END $$;
REVOKE ALL ON FUNCTION app_private.provision_organization(text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.provision_organization(text, text, jsonb) TO menuminute_app;

-- Update app_private.update_outlet_profile to accept optional latitude and longitude
CREATE OR REPLACE FUNCTION app_private.update_outlet_profile(
  p_org text,
  p_outlet text,
  p_expected integer,
  p_data jsonb
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  actor text := NULLIF(current_setting('app.actor_id', true), '');
  r restaurants%ROWTYPE;
  field text;
  email_value text;
  website_value text;
  lat_val numeric;
  lng_val numeric;
BEGIN
  IF actor IS NULL OR p_expected < 0 OR jsonb_typeof(p_data) <> 'object' THEN
    RAISE EXCEPTION 'Invalid profile command' USING ERRCODE = '22023';
  END IF;

  FOR field IN SELECT jsonb_object_keys(p_data) LOOP
    IF field NOT IN (
      'description', 'phone', 'email', 'website',
      'addressLine1', 'addressLine2', 'city', 'state', 'postalCode',
      'primaryColor', 'secondaryColor',
      'pickupLeadMinutes', 'pickupSlotMinutes', 'pickupAdvanceDays',
      'latitude', 'longitude'
    )
    OR (field IN ('pickupLeadMinutes', 'pickupSlotMinutes', 'pickupAdvanceDays') AND jsonb_typeof(p_data->field) <> 'number')
    OR (field IN ('latitude', 'longitude') AND jsonb_typeof(p_data->field) NOT IN ('number', 'null'))
    OR (field NOT IN ('pickupLeadMinutes', 'pickupSlotMinutes', 'pickupAdvanceDays', 'latitude', 'longitude') AND jsonb_typeof(p_data->field) NOT IN ('string', 'null')) THEN
      RAISE EXCEPTION 'Unsupported profile field' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM jsonb_object_keys(p_data)) NOT IN (14, 16) THEN
    RAISE EXCEPTION 'Complete profile payload required' USING ERRCODE = '22023';
  END IF;

  PERFORM 1 FROM organizations WHERE id = p_org AND is_active FOR SHARE;
  IF NOT FOUND OR NOT app_private.can_outlet(p_outlet, 'outlet.manage') THEN
    RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO r FROM restaurants WHERE id = p_outlet AND organization_id = p_org AND is_active FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE = '42501';
  END IF;

  IF r.profile_version <> p_expected THEN
    RAISE EXCEPTION 'Profile changed on another device' USING ERRCODE = '40001';
  END IF;

  IF length(coalesce(p_data->>'description', '')) > 500
  OR length(coalesce(p_data->>'phone', '')) > 40
  OR length(coalesce(p_data->>'email', '')) > 254
  OR length(coalesce(p_data->>'website', '')) > 512
  OR length(coalesce(p_data->>'addressLine1', '')) > 180
  OR length(coalesce(p_data->>'addressLine2', '')) > 180
  OR length(coalesce(p_data->>'city', '')) > 100
  OR length(coalesce(p_data->>'state', '')) > 100
  OR length(coalesce(p_data->>'postalCode', '')) > 24 THEN
    RAISE EXCEPTION 'Profile field exceeds limit' USING ERRCODE = '22023';
  END IF;

  email_value := NULLIF(trim(p_data->>'email'), '');
  website_value := NULLIF(trim(p_data->>'website'), '');

  IF email_value IS NOT NULL AND email_value !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' THEN
    RAISE EXCEPTION 'Invalid email' USING ERRCODE = '22023';
  END IF;

  IF website_value IS NOT NULL AND website_value !~* '^https?://[^[:space:]]+\.[^[:space:]]+$' THEN
    RAISE EXCEPTION 'Invalid website' USING ERRCODE = '22023';
  END IF;

  IF (p_data->>'pickupLeadMinutes')::integer NOT BETWEEN 0 AND 240
  OR (p_data->>'pickupSlotMinutes')::integer NOT BETWEEN 5 AND 120
  OR (p_data->>'pickupAdvanceDays')::integer NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'Invalid pickup scheduling limits' USING ERRCODE = '22023';
  END IF;

  IF (p_data->>'primaryColor') IS NULL OR (p_data->>'secondaryColor') IS NULL
  OR (p_data->>'primaryColor') !~ '^#[0-9a-fA-F]{6}$'
  OR (p_data->>'secondaryColor') !~ '^#[0-9a-fA-F]{6}$' THEN
    RAISE EXCEPTION 'Invalid branding color' USING ERRCODE = '22023';
  END IF;

  IF p_data ? 'latitude' AND (p_data->>'latitude') IS NOT NULL THEN
    lat_val := (p_data->>'latitude')::numeric;
    IF lat_val < -90.0 OR lat_val > 90.0 THEN
      RAISE EXCEPTION 'Invalid latitude' USING ERRCODE = '22023';
    END IF;
  ELSE
    lat_val := r.latitude;
  END IF;

  IF p_data ? 'longitude' AND (p_data->>'longitude') IS NOT NULL THEN
    lng_val := (p_data->>'longitude')::numeric;
    IF lng_val < -180.0 OR lng_val > 180.0 THEN
      RAISE EXCEPTION 'Invalid longitude' USING ERRCODE = '22023';
    END IF;
  ELSE
    lng_val := r.longitude;
  END IF;

  UPDATE restaurants SET
    description = NULLIF(trim(p_data->>'description'), ''),
    phone = NULLIF(trim(p_data->>'phone'), ''),
    email = lower(email_value),
    website = website_value,
    address_line1 = NULLIF(trim(p_data->>'addressLine1'), ''),
    address_line2 = NULLIF(trim(p_data->>'addressLine2'), ''),
    city = NULLIF(trim(p_data->>'city'), ''),
    state = NULLIF(trim(p_data->>'state'), ''),
    postal_code = NULLIF(trim(p_data->>'postalCode'), ''),
    latitude = CASE WHEN p_data ? 'latitude' AND (p_data->>'latitude') IS NOT NULL
                    THEN lat_val::numeric(10, 7)
                    WHEN p_data ? 'latitude' THEN NULL
                    ELSE latitude END,
    longitude = CASE WHEN p_data ? 'longitude' AND (p_data->>'longitude') IS NOT NULL
                     THEN lng_val::numeric(10, 7)
                     WHEN p_data ? 'longitude' THEN NULL
                     ELSE longitude END,
    primary_color = p_data->>'primaryColor',
    secondary_color = p_data->>'secondaryColor',
    pickup_lead_minutes = (p_data->>'pickupLeadMinutes')::integer,
    pickup_slot_minutes = (p_data->>'pickupSlotMinutes')::integer,
    pickup_advance_days = (p_data->>'pickupAdvanceDays')::integer,
    profile_version = profile_version + 1,
    updated_at = now()
  WHERE id = p_outlet;

  INSERT INTO audit_logs(id, user_id, restaurant_id, action, resource_type, resource_id)
  VALUES (gen_random_uuid()::text, actor, p_outlet, 'settings.profile.update', 'outlet', p_outlet);

  RETURN p_expected + 1;
END $$;
REVOKE ALL ON FUNCTION app_private.update_outlet_profile(text, text, integer, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.update_outlet_profile(text, text, integer, jsonb) TO menuminute_app;
