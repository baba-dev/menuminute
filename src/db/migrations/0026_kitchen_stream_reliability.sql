-- PR 2: kitchen event page boundaries and authorized worker retention.
-- A new forward-only migration; do not alter the checksummed 0013/0014 migrations.
CREATE OR REPLACE FUNCTION app_private.kitchen_changes(
 p_outlet text, p_after bigint, p_limit integer DEFAULT 100)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE highwater bigint; events jsonb; first_available bigint; page_end bigint; count_events integer;
BEGIN
 IF NOT app_private.kitchen_access(p_outlet) THEN
  RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 IF p_after IS NULL OR p_after<0 OR p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
  RAISE EXCEPTION 'Invalid cursor' USING ERRCODE='22023';
 END IF;
 SELECT COALESCE(last_seq,0) INTO highwater
 FROM kitchen_event_counters WHERE outlet_id=p_outlet;
 highwater:=COALESCE(highwater,0);
 IF p_after>highwater THEN RAISE EXCEPTION 'Future cursor' USING ERRCODE='22023'; END IF;
 SELECT MIN(seq) INTO first_available FROM kitchen_events WHERE outlet_id=p_outlet;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('seq', e.seq, 'kind', e.kind)
   ORDER BY e.seq), '[]'::jsonb), COUNT(*), MAX(e.seq)
 INTO events,count_events,page_end
 FROM (SELECT seq,kind FROM kitchen_events WHERE outlet_id=p_outlet
   AND seq>p_after ORDER BY seq LIMIT p_limit) e;
 RETURN jsonb_build_object(
  'cursor', COALESCE(page_end, highwater),
  'resync', (first_available IS NOT NULL AND p_after<first_available-1)
    OR (first_available IS NULL AND highwater>p_after)
    OR (count_events=0 AND highwater>p_after),
  'events', events
 );
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_changes(text,bigint,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_changes(text,bigint,integer) TO menuminute_app;

-- Only the scoped, fixed-policy cleanup function is callable by the worker.
-- The worker has no direct SELECT/DELETE access to kitchen tables.
REVOKE ALL ON FUNCTION app_private.kitchen_prune_events() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.kitchen_prune_events() TO menuminute_worker;
