-- 0112: Sitemap feed for public menus.
--  * Lists the stable public menu token of every outlet whose public page is actually served: the same
--    gate as free_menu_public / public_menu_cache_token_active (active QR, active + published outlet,
--    active organization). Table QR codes (table_id set) and order-purpose QR codes are excluded so a
--    restaurant appears once, via its oldest active menu QR.
--  * Returns only the opaque token, a modification time and the demo flag: no names, contact data or menu
--    content. The result is capped by the caller-supplied limit (clamped to 1..50000, the sitemap limit).
--  * SECURITY DEFINER read only; executable by the web role. Additive and forward-only, no data changes.
CREATE FUNCTION app_private.public_menu_sitemap(p_limit integer)
RETURNS TABLE(token text, updated_at timestamptz, is_demo boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
  SELECT s.token, s.updated_at, s.is_demo
    FROM (
      SELECT DISTINCT ON (q.restaurant_id)
             q.destination_token AS token,
             r.updated_at AS updated_at,
             r.is_demo_data AS is_demo,
             q.created_at AS qr_created_at
        FROM qr_codes q
        JOIN restaurants r ON r.id=q.restaurant_id
        JOIN organizations org ON org.id=r.organization_id
       WHERE q.is_active
         AND q.purpose='menu'
         AND q.table_id IS NULL
         AND r.is_active
         AND r.is_published
         AND org.is_active
       ORDER BY q.restaurant_id, q.created_at, q.id
    ) s
   ORDER BY s.qr_created_at, s.token
   LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50000), 50000))
$fn$;
REVOKE ALL ON FUNCTION app_private.public_menu_sitemap(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.public_menu_sitemap(integer) TO menuminute_app;
