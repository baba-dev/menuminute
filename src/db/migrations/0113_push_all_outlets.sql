-- 0113: all-outlet mode for the push worker lanes. The claim functions keep their exact
-- signatures, grants and re-authorization joins; only the outlet predicate changes. The sentinel
-- array ARRAY['*'] (set by the worker only when PWA_PUSH_ALL_OUTLETS=true) selects every outlet.
-- Rollback: redeploy the previous worker (explicit ids) and reinstate migrations 0058/0105 bodies.

CREATE OR REPLACE FUNCTION app_private.pwa_push_claim(p_outlets text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE chosen record; lease text:=gen_random_uuid()::text;
BEGIN
 IF p_outlets IS NULL OR cardinality(p_outlets) NOT BETWEEN 1 AND 50 THEN
 RAISE EXCEPTION 'Invalid push rollout' USING ERRCODE='22023'; END IF;
 UPDATE pwa_push_deliveries SET status='expired',processed_at=now(),lease_token=null,lease_until=null
 WHERE status='pending' AND created_at<now()-interval '10 minutes';
 SELECT d.id,s.endpoint,d.kind INTO chosen
 FROM pwa_push_deliveries d
 JOIN pwa_push_subscriptions s ON s.id=d.subscription_id AND s.enabled AND s.outlet_id=d.outlet_id
 JOIN sessions a ON a.id=s.session_id AND a.user_id=s.user_id AND a.expires_at>now()
 JOIN restaurants r ON r.id=s.outlet_id AND r.organization_id=s.organization_id AND r.is_active
 JOIN organizations o ON o.id=s.organization_id AND o.is_active
 JOIN organization_members m ON m.organization_id=o.id AND m.user_id=s.user_id AND m.is_active
 LEFT JOIN outlet_grants g ON g.organization_id=o.id AND g.member_id=m.id AND g.outlet_id=r.id
 WHERE d.status='pending' AND d.attempts<4 AND d.next_attempt_at<=now()
 AND (d.lease_until IS NULL OR d.lease_until<now())
 AND d.created_at>now()-interval '10 minutes'
 AND (p_outlets=ARRAY['*']::text[] OR d.outlet_id=ANY(p_outlets))
 AND (m.role IN ('owner','admin') OR g.roles && ARRAY['manager','service','kitchen']::text[])
 AND ((d.kind='order.created' AND s.new_orders) OR (d.kind='kitchen.changed' AND s.kitchen_updates))
 -- Kitchen operators only receive activity from a station they CURRENTLY staff.
 -- Owners/admins and explicitly granted outlet managers can receive all.
 AND (
   d.kind <> 'kitchen.changed'
   OR m.role IN ('owner','admin')
   OR g.roles && ARRAY['manager']::text[]
   OR EXISTS(
     SELECT 1 FROM outbox_events oe
     JOIN kitchen_events ke ON ke.outlet_id=d.outlet_id
       AND ke.seq=(oe.payload->>'seq')::bigint
     JOIN kitchen_work kw ON kw.id=ke.work_id AND kw.outlet_id=d.outlet_id
     JOIN kitchen_station_members sm ON sm.outlet_id=d.outlet_id
       AND sm.station_id=kw.station_id AND sm.member_id=m.id
     WHERE oe.id=d.event_id
   )
 )
 ORDER BY d.next_attempt_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE pwa_push_deliveries SET attempts=attempts+1,lease_token=lease,
 lease_until=now()+interval '30 seconds' WHERE id=chosen.id;
 RETURN jsonb_build_object('id',chosen.id,'endpoint',chosen.endpoint,'lease',lease,'kind',chosen.kind);
END $$;

CREATE OR REPLACE FUNCTION app_private.guest_push_claim(p_outlets text[])
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE chosen record; lease text:=gen_random_uuid()::text;
BEGIN
 IF p_outlets IS NULL OR cardinality(p_outlets) NOT BETWEEN 1 AND 50 THEN
   RAISE EXCEPTION 'Invalid push rollout' USING ERRCODE='22023';
 END IF;
 UPDATE guest_push_deliveries SET status='expired',processed_at=now(),lease_token=null,lease_until=null
 WHERE status='pending' AND created_at<now()-interval '10 minutes';
 SELECT d.id,s.endpoint INTO chosen
 FROM guest_push_deliveries d
 JOIN guest_push_subscriptions s ON s.id=d.subscription_id AND s.enabled
   AND s.expires_at>now() AND s.outlet_id=d.outlet_id
 JOIN restaurants r ON r.id=s.outlet_id AND r.organization_id=s.organization_id
   AND r.is_active AND NOT r.is_demo_data
 JOIN organizations o ON o.id=s.organization_id AND o.is_active
 WHERE d.status='pending' AND d.attempts<4 AND d.next_attempt_at<=now()
   AND (d.lease_until IS NULL OR d.lease_until<now())
   AND d.created_at>now()-interval '10 minutes'
   AND (p_outlets=ARRAY['*']::text[] OR d.outlet_id=ANY(p_outlets))
 ORDER BY d.next_attempt_at,d.id FOR UPDATE OF d SKIP LOCKED LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 UPDATE guest_push_deliveries SET attempts=attempts+1,lease_token=lease,
   lease_until=now()+interval '30 seconds' WHERE id=chosen.id;
 RETURN jsonb_build_object('id',chosen.id,'endpoint',chosen.endpoint,'lease',lease);
END $fn$;

