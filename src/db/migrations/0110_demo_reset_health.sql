-- Public demo freshness audit. Separate from tenant-scoped production kitchen mutations.
-- Read-only, fixed to the owner-approved demo outlet and callable only by the restricted worker.
-- The reset itself remains the sole mutation path (migration 0077).
CREATE FUNCTION app_private.demo_reset_health() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE
  o CONSTANT text := 'demo-outlet';
  org CONSTANT text := 'org-demo-outlet';
  last_run timestamptz;
  oldest_active timestamptz;
  active_count integer;
BEGIN
  IF NOT EXISTS(
    SELECT 1 FROM restaurants
    WHERE id=o AND organization_id=org AND is_demo_data
  ) THEN
    RAISE EXCEPTION 'Demo outlet is not provisioned' USING ERRCODE='42501';
  END IF;

  SELECT max(ran_at) INTO last_run FROM app_private.demo_reset_runs;
  SELECT count(*)::integer, min(w.created_at)
    INTO active_count, oldest_active
  FROM kitchen_work w
  JOIN orders ord ON ord.id=w.order_id AND ord.restaurant_id=o
  WHERE w.outlet_id=o
    AND w.status IN ('queued','preparing')
    AND ord.status IN ('accepted','preparing');

  RETURN jsonb_build_object(
    'activeTickets',active_count,
    'oldestActiveMinutes',
      CASE WHEN oldest_active IS NULL THEN NULL
        ELSE greatest(0,floor(extract(epoch FROM (clock_timestamp()-oldest_active))/60))::integer
      END,
    'lastResetAgeMinutes',
      CASE WHEN last_run IS NULL THEN NULL
        ELSE greatest(0,floor(extract(epoch FROM (clock_timestamp()-last_run))/60))::integer
      END
  );
END $fn$;
REVOKE ALL ON FUNCTION app_private.demo_reset_health() FROM PUBLIC,menuminute_app,menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.demo_reset_health() TO menuminute_worker;
