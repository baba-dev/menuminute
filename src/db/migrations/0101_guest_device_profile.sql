-- Diner device memory (opt-in). Forward-only, additive, after 0100.
-- A device is an opaque random token held in an httpOnly cookie; only its SHA-256 hash is
-- stored here. It remembers a diner's chosen name and phone for ONE organization so checkout can
-- prefill. It is not a login, grants no access to orders, and is never created for the public demo.
CREATE TABLE guest_devices (
 id text PRIMARY KEY,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
 display_name text NOT NULL DEFAULT '' CHECK (length(display_name) <= 80),
 phone text NOT NULL DEFAULT '' CHECK (phone = '' OR phone ~ '^\+?[0-9]{8,15}$'),
 notice_version text NOT NULL CHECK (notice_version ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 last_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 CHECK (revoked_at IS NULL OR (display_name = '' AND phone = ''))
);
CREATE INDEX guest_devices_expiry ON guest_devices(expires_at);
CREATE INDEX guest_devices_revoked ON guest_devices(revoked_at) WHERE revoked_at IS NOT NULL;
ALTER TABLE guest_devices ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON guest_devices FROM PUBLIC, menuminute_app, menuminute_worker;

CREATE FUNCTION app_private.guest_device_remember(
 p_token text, p_hash text, p_name text, p_phone text, p_notice text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE org text; demo boolean; nm text:=btrim(coalesce(p_name,'')); ph text:=btrim(coalesce(p_phone,''));
BEGIN
 IF p_token IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$'
    OR p_notice IS NULL OR p_notice !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
    OR length(nm)>80 OR (ph<>'' AND ph !~ '^\+?[0-9]{8,15}$') OR (nm='' AND ph='') THEN
   RAISE EXCEPTION 'Invalid device profile' USING ERRCODE='22023';
 END IF;
 SELECT r.organization_id,r.is_demo_data INTO org,demo FROM qr_codes q
   JOIN restaurants r ON r.id=q.restaurant_id AND r.is_active
   JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE q.destination_token=p_token AND q.is_active LIMIT 1;
 IF org IS NULL THEN RAISE EXCEPTION 'Menu unavailable' USING ERRCODE='42501'; END IF;
 IF demo THEN
   RAISE EXCEPTION 'The public demo does not store diner profiles' USING ERRCODE='22023';
 END IF;
 INSERT INTO guest_devices(id,organization_id,token_hash,display_name,phone,notice_version,expires_at)
 VALUES(gen_random_uuid()::text,org,p_hash,nm,ph,p_notice,clock_timestamp()+interval '180 days')
 ON CONFLICT (token_hash) DO UPDATE SET
   display_name=EXCLUDED.display_name, phone=EXCLUDED.phone,
   notice_version=EXCLUDED.notice_version, last_seen_at=clock_timestamp(),
   expires_at=EXCLUDED.expires_at
 WHERE guest_devices.organization_id=org AND guest_devices.revoked_at IS NULL;
 IF NOT FOUND THEN RAISE EXCEPTION 'Device unavailable' USING ERRCODE='42501'; END IF;
 RETURN jsonb_build_object('remembered',true);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_device_remember(text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_device_remember(text,text,text,text,text) TO menuminute_app;

-- Returns null for an unknown, expired, revoked or other-organization device. Slides expiry at
-- most once a day so a read cannot become a write storm.
CREATE FUNCTION app_private.guest_device_lookup(p_token text, p_hash text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE org text; d guest_devices%ROWTYPE;
BEGIN
 IF p_token IS NULL OR p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN RETURN NULL; END IF;
 SELECT r.organization_id INTO org FROM qr_codes q
   JOIN restaurants r ON r.id=q.restaurant_id AND r.is_active
   JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE q.destination_token=p_token AND q.is_active LIMIT 1;
 IF org IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO d FROM guest_devices
 WHERE token_hash=p_hash AND organization_id=org AND revoked_at IS NULL
   AND expires_at>clock_timestamp();
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF d.last_seen_at < clock_timestamp()-interval '1 day' THEN
   UPDATE guest_devices SET last_seen_at=clock_timestamp(),
     expires_at=clock_timestamp()+interval '180 days' WHERE id=d.id;
 END IF;
 RETURN jsonb_build_object('name',d.display_name,'phone',d.phone);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_device_lookup(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_device_lookup(text,text) TO menuminute_app;

-- Forgetting scrubs personal data immediately; the empty revoked row is kept briefly so a stale
-- cookie cannot recreate the same identity, then pruned.
CREATE FUNCTION app_private.guest_device_forget(p_hash text)
RETURNS boolean LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF p_hash IS NULL OR p_hash !~ '^[0-9a-f]{64}$' THEN RETURN false; END IF;
 UPDATE guest_devices SET display_name='',phone='',revoked_at=clock_timestamp()
 WHERE token_hash=p_hash AND revoked_at IS NULL;
 RETURN FOUND;
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_device_forget(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_device_forget(text) TO menuminute_app;

CREATE FUNCTION app_private.guest_device_prune()
RETURNS integer LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE removed integer;
BEGIN
 DELETE FROM guest_devices
 WHERE expires_at<clock_timestamp() OR revoked_at<clock_timestamp()-interval '7 days';
 GET DIAGNOSTICS removed=ROW_COUNT;
 RETURN removed;
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_device_prune() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_device_prune() TO menuminute_worker;
