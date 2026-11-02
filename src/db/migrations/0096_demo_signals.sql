-- Live table signals, slice 6: sample signals for the public demo outlet. Forward-only, after 0095.
-- Hardcoded to the single owner-approved demo outlet (ADR 022), refuses unless it is flagged
-- is_demo_data, and executable only by menuminute_worker. It switches live table signals on for the demo
-- outlet only, clears that outlet's ledger and re-seeds a few guest-side samples (QR scans, an open water
-- request, an acknowledged one, a shown bill) plus order-lifecycle events backfilled from the demo
-- orders' own status history. Called by the worker right after each reset_demo_outlet. No outbound effects.
-- Demo signals are sample data; they never touch another outlet, entitlements, billing, POS or AI spend.
-- Rollback: stop calling it; the demo rows are wiped by the next reset.
CREATE FUNCTION app_private.seed_demo_signals() RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE
  o CONSTANT text := 'demo-outlet';
  org text; qrs integer := 0; orders_n integer := 0; reqs integer := 0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM restaurants WHERE id=o AND is_demo_data) THEN
    RAISE EXCEPTION 'Demo outlet is not provisioned' USING ERRCODE='42501';
  END IF;
  SELECT organization_id INTO org FROM restaurants WHERE id=o;
  INSERT INTO floor_signal_settings(outlet_id,enabled) VALUES(o,true)
  ON CONFLICT (outlet_id) DO UPDATE SET enabled=true,updated_at=now();

  DELETE FROM table_signal_events WHERE outlet_id=o;

  -- Order lifecycle from the demo orders' own status history (the slice 4 mapping, last 6 hours).
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key,occurred_at)
  SELECT gen_random_uuid()::text,o,od.table_id,
         CASE e.to_status WHEN 'pending' THEN 'order_placed' WHEN 'accepted' THEN 'order_accepted'
           WHEN 'preparing' THEN 'kitchen_preparing' WHEN 'ready' THEN 'kitchen_ready' ELSE 'order_served' END,
         CASE WHEN e.to_status IN ('preparing','ready') THEN 'kitchen' ELSE 'orders' END,
         od.id,
         'ord:'||od.id||':'||CASE e.to_status WHEN 'pending' THEN 'order_placed' WHEN 'accepted' THEN 'order_accepted'
           WHEN 'preparing' THEN 'kitchen_preparing' WHEN 'ready' THEN 'kitchen_ready' ELSE 'order_served' END,
         e.created_at
    FROM order_status_events e
    JOIN orders od ON od.id=e.order_id AND od.restaurant_id=o AND od.table_id IS NOT NULL
   WHERE e.restaurant_id=o AND e.to_status IN ('pending','accepted','preparing','ready','served','delivered','collected')
     AND e.created_at > clock_timestamp()-interval '6 hours'
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;
  GET DIAGNOSTICS orders_n = ROW_COUNT;

  -- Guest-side samples on tables that exist in the demo floor.
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key,occurred_at)
  SELECT gen_random_uuid()::text,o,t.id,'qr_scanned','guest','demo-sample','demo:qr:'||t.id,
         clock_timestamp()-make_interval(mins=>v.mins)
    FROM (VALUES ('demo-table-1',14),('demo-table-2',9),('demo-table-3',6),('demo-table-5',4),('demo-table-6',3)) v(tid,mins)
    JOIN restaurant_tables t ON t.id=v.tid AND t.restaurant_id=o AND t.is_active
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;
  GET DIAGNOSTICS qrs = ROW_COUNT;

  -- Two open water requests (one waiting, one acknowledged). The trigger writes their signals.
  DELETE FROM guest_service_requests WHERE outlet_id=o AND signal='water_refill' AND order_id IS NULL;
  INSERT INTO guest_service_requests(id,organization_id,outlet_id,order_id,table_id,signal,status,requested_at)
  SELECT 'demo-water-'||t.id,org,o,NULL,t.id,'water_refill','requested',clock_timestamp()-interval '2 minutes'
    FROM restaurant_tables t WHERE t.id='demo-table-3' AND t.restaurant_id=o AND t.is_active;
  INSERT INTO guest_service_requests(id,organization_id,outlet_id,order_id,table_id,signal,status,requested_at,
                                     acknowledged_at,acknowledged_by)
  SELECT 'demo-water-'||t.id,org,o,NULL,t.id,'water_refill','acknowledged',clock_timestamp()-interval '4 minutes',
         clock_timestamp()-interval '3 minutes','demo-manager'
    FROM restaurant_tables t WHERE t.id='demo-table-6' AND t.restaurant_id=o AND t.is_active
     AND EXISTS(SELECT 1 FROM users WHERE id='demo-manager');
  GET DIAGNOSTICS reqs = ROW_COUNT;

  -- A bill that was shown to one table.
  INSERT INTO table_signal_events(id,outlet_id,table_id,kind,source,ref_id,dedupe_key,occurred_at)
  SELECT gen_random_uuid()::text,o,t.id,'bill_presented','pos','demo-sample','demo:bill:'||t.id,
         clock_timestamp()-interval '1 minute'
    FROM restaurant_tables t WHERE t.id='demo-table-2' AND t.restaurant_id=o AND t.is_active
  ON CONFLICT (outlet_id,dedupe_key) DO NOTHING;

  RETURN jsonb_build_object('orderSignals',orders_n,'qrSignals',qrs,'waterRequests',reqs);
END $fn$;
REVOKE ALL ON FUNCTION app_private.seed_demo_signals() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.seed_demo_signals() TO menuminute_worker;
