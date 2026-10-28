-- 0035: Allow active organization owners and admins to operate their own kitchen.
-- Staff picker shows all active organization members; actual station assignment still
-- requires organization owner/admin or a live manager/kitchen outlet grant.
-- Keep the existing SECURITY DEFINER, scoped authorization, RLS, audit and
-- Kitchen Pro release flags intact. Applied 0013/0014/0028 files are immutable.
-- A reviewer must verify this migration's checksum and restricted-role behavior.

CREATE OR REPLACE FUNCTION app_private.kitchen_admin(p_outlet text,p_action text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org text; station text; member text; actor text:=NULLIF(current_setting('app.actor_id',true),''); result jsonb:='{}'::jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'outlet.manage') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet FOR SHARE;
 IF org IS NULL OR jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN
   RAISE EXCEPTION 'Invalid kitchen command' USING ERRCODE='22023'; END IF;
 IF p_action='station.create' THEN
   IF length(trim(p_data->>'name')) NOT BETWEEN 2 AND 64 THEN RAISE EXCEPTION 'Invalid station name' USING ERRCODE='22023'; END IF;
   station:='kst-'||gen_random_uuid()::text;
   INSERT INTO kitchen_stations(id,outlet_id,name) VALUES(station,p_outlet,trim(p_data->>'name'));
   result:=jsonb_build_object('stationId',station);
   PERFORM app_private.kitchen_emit(p_outlet,'station.changed');
 ELSIF p_action='station.rename' THEN
   UPDATE kitchen_stations SET name=trim(p_data->>'name')
    WHERE outlet_id=p_outlet AND id=p_data->>'stationId' AND active
      AND length(trim(p_data->>'name')) BETWEEN 2 AND 64;
   IF NOT FOUND THEN RAISE EXCEPTION 'Station unavailable' USING ERRCODE='22023'; END IF;
   PERFORM app_private.kitchen_emit(p_outlet,'station.changed');
 ELSIF p_action='member.assign' OR p_action='member.remove' THEN
   station:=p_data->>'stationId'; member:=p_data->>'memberId';
   IF NOT EXISTS(SELECT 1 FROM kitchen_stations WHERE outlet_id=p_outlet AND id=station AND active)
   OR NOT EXISTS(
     SELECT 1 FROM organization_members m
     WHERE m.id=member AND m.organization_id=org
       AND (p_action='member.remove' OR
         (m.is_active AND (m.role IN ('owner','admin') OR EXISTS(
           SELECT 1 FROM outlet_grants g
           WHERE g.organization_id=org AND g.member_id=m.id AND g.outlet_id=p_outlet
             AND g.roles && ARRAY['manager','kitchen']::text[]
         ))))
   ) THEN
      RAISE EXCEPTION 'Unassigned member or station' USING ERRCODE='22023'; END IF;
   IF p_action='member.assign' THEN
    INSERT INTO kitchen_station_members(outlet_id,station_id,member_id,organization_id)
    VALUES(p_outlet,station,member,org) ON CONFLICT DO NOTHING;
   ELSE
    DELETE FROM kitchen_station_members WHERE outlet_id=p_outlet AND station_id=station AND member_id=member;
   END IF;
   PERFORM app_private.kitchen_emit(p_outlet,'station.changed');
 ELSIF p_action='route.assign' OR p_action='route.remove' THEN
   station:=p_data->>'stationId';
   IF length(p_data->>'dishId') NOT BETWEEN 1 AND 128
      OR NOT EXISTS(SELECT 1 FROM kitchen_stations WHERE outlet_id=p_outlet AND id=station AND active) THEN
     RAISE EXCEPTION 'Invalid route' USING ERRCODE='22023'; END IF;
   IF p_action='route.assign' THEN
     INSERT INTO kitchen_routes(outlet_id,dish_id,station_id) VALUES(p_outlet,p_data->>'dishId',station)
     ON CONFLICT(outlet_id,dish_id,station_id) DO UPDATE SET rule_version=kitchen_routes.rule_version+1;
   ELSE
     DELETE FROM kitchen_routes WHERE outlet_id=p_outlet AND dish_id=p_data->>'dishId' AND station_id=station;
   END IF;
   PERFORM app_private.kitchen_emit(p_outlet,'route.changed');
 ELSIF p_action='settings.disable' THEN
   -- Activation is deliberately deferred to integrated expeditor/rollout PR E.
   INSERT INTO kitchen_outlet_settings(outlet_id,enabled) VALUES(p_outlet,false)
   ON CONFLICT(outlet_id) DO UPDATE SET enabled=false,revision=kitchen_outlet_settings.revision+1,updated_at=now();
   PERFORM app_private.kitchen_emit(p_outlet,'settings.changed');
 ELSE RAISE EXCEPTION 'Unknown kitchen action' USING ERRCODE='22023'; END IF;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,org,actor,'kitchen.'||p_action,p_data);
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION app_private.kitchen_snapshot(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb; is_admin boolean; member text;
BEGIN
 IF NOT app_private.kitchen_access(p_outlet) THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT m.id,(m.role IN ('owner','admin') OR app_private.can_outlet(p_outlet,'outlet.manage')) INTO member,is_admin
 FROM organization_members m JOIN restaurants r ON r.organization_id=m.organization_id
 WHERE r.id=p_outlet AND m.user_id=current_setting('app.actor_id',true) AND m.is_active;
 SELECT jsonb_build_object(
 'cursor',COALESCE((SELECT last_seq FROM kitchen_event_counters WHERE outlet_id=p_outlet),0),
 'enabled',COALESCE((SELECT enabled FROM kitchen_outlet_settings WHERE outlet_id=p_outlet),false),
 'stations',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'active',s.active,
   'position',s.position) ORDER BY s.position,s.name) FROM kitchen_stations s
   WHERE s.outlet_id=p_outlet AND s.active AND (is_admin OR EXISTS(
    SELECT 1 FROM kitchen_station_members sm WHERE sm.station_id=s.id AND sm.member_id=member))), '[]'::jsonb),
 'routes',CASE WHEN is_admin THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('dishId',dish_id,'stationId',station_id,'ruleVersion',rule_version) ORDER BY dish_id,station_id)
 FROM kitchen_routes WHERE outlet_id=p_outlet),'[]'::jsonb) ELSE '[]'::jsonb END,
 'members',CASE WHEN is_admin THEN COALESCE((SELECT jsonb_agg(jsonb_build_object(
   'id',m.id,'name',u.name,'role',m.role,
   'eligible',(m.role IN ('owner','admin') OR EXISTS(
     SELECT 1 FROM outlet_grants g WHERE g.organization_id=m.organization_id
       AND g.member_id=m.id AND g.outlet_id=p_outlet
       AND g.roles && ARRAY['manager','kitchen']::text[])),
   'stationIds',COALESCE((SELECT jsonb_agg(sm.station_id ORDER BY sm.station_id)
     FROM kitchen_station_members sm WHERE sm.member_id=m.id AND sm.outlet_id=p_outlet),'[]'::jsonb))
   ORDER BY u.name,m.id)
   FROM organization_members m JOIN users u ON u.id=m.user_id
   JOIN restaurants r ON r.organization_id=m.organization_id
   WHERE r.id=p_outlet AND m.is_active),'[]'::jsonb)
   ELSE '[]'::jsonb END,
 'workOverflow',(SELECT COUNT(*)>500 FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=p_outlet
 WHERE w.outlet_id=p_outlet AND w.status IN ('queued','preparing','complete') AND o.status IN ('accepted','preparing')
 AND (is_admin OR EXISTS(SELECT 1 FROM kitchen_station_members sm WHERE sm.station_id=w.station_id AND sm.member_id=member))),
 'work',COALESCE((SELECT jsonb_agg(x.payload ORDER BY x.created_at,x.id) FROM (SELECT jsonb_build_object(
   'id',w.id,'stationId',w.station_id,'orderId',w.order_id,'orderNumber',o.order_number,
   'fulfillmentMode',o.fulfillment_mode,'tableLabel',t.table_number,'brandLabel',r.name,
   'dishName',i.item_name,'quantity',i.quantity,'variantName',i.variant_name,
   'selectedOptions',i.selected_options,'notes',i.notes,'orderNotes',o.notes,
   'status',w.status,'version',w.version,'createdAt',w.created_at,'updatedAt',w.updated_at) AS payload,w.created_at,w.id
  FROM kitchen_work w JOIN orders o ON o.id=w.order_id AND o.restaurant_id=p_outlet
  JOIN order_items i ON i.id=w.order_item_id JOIN restaurants r ON r.id=p_outlet
  LEFT JOIN restaurant_tables t ON t.id=o.table_id
  WHERE w.outlet_id=p_outlet AND w.status IN ('queued','preparing','complete')
   AND o.status IN ('accepted','preparing')
   AND (is_admin OR EXISTS(SELECT 1 FROM kitchen_station_members sm
     WHERE sm.station_id=w.station_id AND sm.member_id=member))
  ORDER BY w.created_at,w.id LIMIT 500) x),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION app_private.kitchen_pilot_status(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE result jsonb; st integer; assigned integer; unmanned integer; dishes integer; missing integer;
        incomplete integer; ord_enabled boolean; kit_enabled boolean; enabled_flag boolean;
        pilot kitchen_pilot_outlets%ROWTYPE; org text;
BEGIN
 IF NOT app_private.is_super_admin(NULLIF(current_setting('app.actor_id',true),'')) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet AND is_active;
 IF org IS NULL OR NOT EXISTS(SELECT 1 FROM organizations WHERE id=org AND is_active) THEN
   RAISE EXCEPTION 'Outlet unavailable' USING ERRCODE='22023';
 END IF;
 SELECT * INTO pilot FROM kitchen_pilot_outlets WHERE outlet_id=p_outlet;
 SELECT count(*)::integer INTO st FROM kitchen_stations WHERE outlet_id=p_outlet AND active;
 SELECT count(DISTINCT sm.member_id)::integer INTO assigned
 FROM kitchen_station_members sm
 JOIN kitchen_stations s ON s.id=sm.station_id AND s.outlet_id=p_outlet AND s.active
 JOIN organization_members m ON m.id=sm.member_id AND m.is_active AND m.organization_id=org
 WHERE sm.outlet_id=p_outlet AND
 (m.role IN ('owner','admin') OR EXISTS(
   SELECT 1 FROM outlet_grants g WHERE g.member_id=m.id AND g.organization_id=org
     AND g.outlet_id=p_outlet AND g.roles && ARRAY['manager','kitchen']::text[]
 ));
 SELECT count(*)::integer INTO unmanned FROM kitchen_stations s
 WHERE s.outlet_id=p_outlet AND s.active
 AND EXISTS (SELECT 1 FROM kitchen_routes kr WHERE kr.station_id=s.id AND kr.outlet_id=p_outlet)
 AND NOT EXISTS (
   SELECT 1 FROM kitchen_station_members sm
   JOIN organization_members m ON m.id=sm.member_id AND m.organization_id=org AND m.is_active
   WHERE sm.station_id=s.id AND sm.outlet_id=p_outlet
   AND (m.role IN ('owner','admin') OR EXISTS(
     SELECT 1 FROM outlet_grants g WHERE g.organization_id=org AND g.member_id=m.id
       AND g.outlet_id=p_outlet AND g.roles && ARRAY['manager','kitchen']::text[]
   ))
 );
 WITH published AS (
   SELECT DISTINCT m.id,rel.document
   FROM menus m JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision
   WHERE NOT m.archived AND m.organization_id=org AND
      (m.outlet_id=p_outlet OR EXISTS
        (SELECT 1 FROM menu_assignments a WHERE a.menu_id=m.id AND a.outlet_id=p_outlet))
 ),
 dish_ids AS (
   SELECT DISTINCT dish->>'id' AS dish_id
   FROM published p
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.document->'categories','[]'::jsonb)) cat
   CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cat->'items','[]'::jsonb)) dish
   WHERE COALESCE((cat->>'archived')::boolean,false)=false
     AND COALESCE((dish->>'archived')::boolean,false)=false
 )
 SELECT count(*)::integer,
        count(*) FILTER (WHERE NOT EXISTS
          (SELECT 1 FROM kitchen_routes kr
           JOIN kitchen_stations ks ON ks.id=kr.station_id AND ks.outlet_id=p_outlet AND ks.active
           WHERE kr.outlet_id=p_outlet AND kr.dish_id=dish_ids.dish_id))::integer
 INTO dishes,missing FROM dish_ids;
 SELECT count(DISTINCT o.id)::integer INTO incomplete
 FROM orders o JOIN kitchen_work w ON w.order_id=o.id AND w.outlet_id=p_outlet
 WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing');
 SELECT COALESCE(enabled,false) INTO enabled_flag FROM kitchen_outlet_settings WHERE outlet_id=p_outlet;
 -- Superadmin status is cross-tenant: entitlement_allowed() also requires
 -- organization membership, which a platform reviewer must not need.
 SELECT EXISTS (
   SELECT 1 FROM entitlement_grants g WHERE g.organization_id=org
     AND g.capability='ordering.new' AND g.revoked_at IS NULL
     AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp()
 ), EXISTS (
   SELECT 1 FROM entitlement_grants g WHERE g.organization_id=org
     AND g.capability='kitchen.new' AND g.revoked_at IS NULL
     AND g.starts_at<=clock_timestamp() AND g.ends_at>clock_timestamp()
 ) INTO ord_enabled,kit_enabled;
 result:=jsonb_build_object(
   'outletId',p_outlet,'organizationId',org,
   'state',coalesce(pilot.state,'setup'),'revision',coalesce(pilot.revision,0),
   'releaseSha',pilot.release_sha,'evidenceUrl',pilot.evidence_url,
   'requestedBy',pilot.requested_by,'approvedBy',pilot.approved_by,
   'approvedAt',pilot.approved_at,'expiresAt',pilot.expires_at,
   'enabled',coalesce(enabled_flag,false),
   'activeStations',st,'assignedMembers',assigned,'unmannedStations',unmanned,
   'publishedDishes',dishes,'unroutedDishes',missing,
   'openKitchenOrders',incomplete,
   'orderingEntitled',coalesce(ord_enabled,false),
   'kitchenEntitled',coalesce(kit_enabled,false),
   'configurationReady',(st>0 AND assigned>0 AND unmanned=0 AND dishes>0 AND missing=0)
 );
 RETURN result;
END $fn$;
