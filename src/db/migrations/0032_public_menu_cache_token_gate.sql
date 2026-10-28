-- Keep QR revocation and organization/outlet deactivation authoritative on cache hits.
-- This gate is deliberately small: it does NOT materialize or parse the menu JSON.
-- It is called even when Redis contains a supposedly fresh public menu.
CREATE FUNCTION app_private.public_menu_cache_token_active(
  p_token text, p_outlet text
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
  SELECT EXISTS(
    SELECT 1
      FROM qr_codes q
      JOIN restaurants r ON r.id=q.restaurant_id
      JOIN organizations org ON org.id=r.organization_id
     WHERE q.destination_token=p_token
       AND q.restaurant_id=p_outlet
       AND q.is_active
       AND r.is_active
       AND r.is_published
       AND org.is_active
  )
$fn$;
REVOKE ALL ON FUNCTION app_private.public_menu_cache_token_active(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.public_menu_cache_token_active(text,text) TO menuminute_app;
