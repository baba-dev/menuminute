-- Deferred email verification: allow an authenticated, not-yet-verified account to provision its
-- first organization/outlet so signup-to-operational stays under a minute when the mail provider
-- is slow. Only the verified-account gate on provision_organization is relaxed; the three-owner
-- organization quota, advisory locking and idempotent request replay are unchanged.
-- Forward-only: invitations (issue/accept), step-up and admin gates keep requiring email_verified.
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

  -- Serialize the owner before checking the new-account quota. Email verification is a
  -- deferred, nagged step: a signed-in account may create its first workspace immediately.
  -- Invitations, billing, MFA step-up and administrator roles still require a verified email.
  PERFORM 1 FROM users WHERE id = actor FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown actor' USING ERRCODE = '42501';
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
    pickup_lead_minutes, pickup_slot_minutes, pickup_advance_days,
    operating_hours, service_hours, onboarding_goal,
    operations_contact_name, operations_contact_phone, operations_contact_email
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
    COALESCE((request_input->>'pickupAdvanceDays')::integer, 7),
    NULLIF(request_input->'operatingHours','null'::jsonb),
    NULLIF(request_input->'serviceHours','null'::jsonb),
    COALESCE(request_input->>'onboardingGoal','qr_menu'),
    NULLIF(trim(request_input->>'operationsContactName'), ''),
    NULLIF(trim(request_input->>'operationsContactPhone'), ''),
    lower(NULLIF(trim(request_input->>'operationsContactEmail'), ''))
  );

  INSERT INTO app_private.provisioning_requests(outlet_id, actor_id, input)
  VALUES (outlet, actor, request_input - 'svgData');

  INSERT INTO brands(id, organization_id, name) VALUES ('brand-' || outlet, org, request_input->>'name');
  INSERT INTO brand_outlets(organization_id, brand_id, outlet_id) VALUES (org, 'brand-' || outlet, outlet);

  INSERT INTO qr_codes(id, restaurant_id, destination_token, svg_data, label)
  VALUES ('qr-' || outlet, outlet, token, request_input->>'svgData', 'Main Menu QR');

  -- Initial Dine-In tables generation if requested
  -- Service points are meaningful only for dine-in; pickup-only outlets must remain table-free.
  IF (request_input->>'tableCount') IS NOT NULL
     AND (request_input->>'tableCount')::integer > 0
     AND COALESCE(request_input->'fulfillmentModes' ? 'dine_in',
       COALESCE(request_input->>'outletType','restaurant') NOT IN ('cafe','takeout','cloud_kitchen')) THEN
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

-- Membership activation still requires a verified email, with one deliberate exception: the very
-- first (owner) membership of a brand-new organization, which only provision_organization creates.
-- Invitation acceptance, role grants and ownership transfers into an existing organization remain
-- blocked for unverified identities.
CREATE OR REPLACE FUNCTION app_private.require_verified_member() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.is_active AND NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.user_id AND email_verified=true) THEN
  IF TG_OP = 'INSERT' AND NEW.role = 'owner' AND NOT EXISTS (
    SELECT 1 FROM organization_members m
    WHERE m.organization_id = NEW.organization_id AND m.id <> NEW.id AND m.is_active
  ) THEN
   RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Verified email required before membership activation' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
