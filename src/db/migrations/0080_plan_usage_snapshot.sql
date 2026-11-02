-- 0080: read-only Free-intake snapshot for the plan usage meters (slice 2c).
-- The application role cannot read app_private.plan_settings, so the dashboard gets exactly three
-- facts through this function: whether free intake is on, this month's count and the cap.
-- Returns NULL to callers who cannot read the outlet's menu; changes no data.
CREATE FUNCTION app_private.free_intake_snapshot(p_outlet text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT CASE WHEN app_private.can_outlet(p_outlet,'menu.read') THEN
    (SELECT jsonb_build_object(
        'enabled', s.free_intake_enabled,
        'used', app_private.free_intake_used(p_outlet),
        'cap', s.free_intake_monthly_cap)
     FROM app_private.plan_settings s WHERE s.singleton)
  END
$$;
REVOKE ALL ON FUNCTION app_private.free_intake_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.free_intake_snapshot(text) TO menuminute_app;
