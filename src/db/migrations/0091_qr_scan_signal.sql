-- Live table signals, slice 2: the QR scan ping. Forward-only, after 0090.
-- A scan is only a phone opening the table QR, never proof that a guest is seated.
-- Recorded only when the outlet opted in (floor_signal_settings.enabled AND qr_scan_pings),
-- only for an active QR tied to an active table, and at most once per QR per minute (dedupe_key).
-- Rollback: stop calling the functions; the ledger rows expire on their own.

CREATE FUNCTION app_private.record_qr_scan(p_token text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE q qr_codes%ROWTYPE; inserted integer;
BEGIN
  IF p_token IS NULL OR char_length(p_token) NOT BETWEEN 12 AND 128 THEN
    RETURN jsonb_build_object('recorded',false);
  END IF;
  SELECT c.* INTO q FROM qr_codes c
    JOIN restaurants r ON r.id=c.restaurant_id AND r.is_active
    JOIN organizations o ON o.id=r.organization_id AND o.is_active
   WHERE c.destination_token=p_token AND c.is_active LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('recorded',false); END IF;
  -- scan_count is the existing counter for this QR; it was never incremented before.
  UPDATE qr_codes SET scan_count=scan_count+1 WHERE id=q.id;
  IF q.table_id IS NULL THEN RETURN jsonb_build_object('recorded',false); END IF;
  IF NOT EXISTS(SELECT 1 FROM floor_signal_settings s
                 WHERE s.outlet_id=q.restaurant_id AND s.enabled AND s.qr_scan_pings)
     OR NOT EXISTS(SELECT 1 FROM restaurant_tables t
                    WHERE t.id=q.table_id AND t.restaurant_id=q.restaurant_id AND t.is_active) THEN
    RETURN jsonb_build_object('recorded',false);
  END IF;
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key)
  VALUES(gen_random_uuid()::text,q.restaurant_id,q.table_id,'qr_scanned','guest',q.id,
         'qr:'||q.id||':'||floor(extract(epoch FROM clock_timestamp())/60)::bigint)
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN jsonb_build_object('recorded',inserted>0);
END $fn$;
REVOKE ALL ON FUNCTION app_private.record_qr_scan(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.record_qr_scan(text) TO menuminute_app;

-- Fixed retention: signals are live telemetry, not records. Called by the worker.
CREATE FUNCTION app_private.prune_table_signals() RETURNS integer
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE n integer;
BEGIN
  DELETE FROM table_signal_events WHERE occurred_at < clock_timestamp()-interval '48 hours';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $fn$;
REVOKE ALL ON FUNCTION app_private.prune_table_signals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.prune_table_signals() TO menuminute_worker;
