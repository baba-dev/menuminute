-- Allergen / dietary chips for kitchen tickets.
-- Each order item snapshots the dish's MERCHANT-ENTERED safety profile from the
-- outlet's published menu at the moment the item is created, so the kitchen sees
-- what the restaurant declared when the guest ordered, not later edits. Nothing
-- is inferred: a dish without a declared profile snapshots no allergens and the
-- UI shows no chip (absence is never presented as "allergen free").
-- The snapshot is advisory: any failure leaves the column NULL and never blocks
-- ordering. Existing orders are not backfilled. The column is nullable, so an
-- application rollback is harmless.
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS dish_safety jsonb;

CREATE OR REPLACE FUNCTION app_private.order_item_snapshot_safety()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE d jsonb;
BEGIN
 IF NEW.dish_safety IS NOT NULL THEN RETURN NEW; END IF;
 BEGIN
  SELECT item.value INTO d
  FROM menus m
  JOIN menu_assignments a ON a.menu_id=m.id AND a.outlet_id=NEW.restaurant_id
  JOIN menu_releases r ON r.menu_id=m.id AND r.revision=m.published_revision
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(r.document->'categories','[]'::jsonb)) AS cat(value)
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(cat.value->'items','[]'::jsonb)) AS item(value)
  WHERE m.published_revision IS NOT NULL AND NOT m.archived AND item.value->>'id'=NEW.dish_id
  ORDER BY m.id LIMIT 1;
  IF d IS NOT NULL THEN
   NEW.dish_safety:=jsonb_strip_nulls(jsonb_build_object(
    'declared',(d->'safety') IS NOT NULL,
    'allergens',COALESCE(d->'safety'->'allergens','[]'::jsonb),
    'crossContact',NULLIF(d->'safety'->>'crossContact',''),
    'verified',COALESCE((d->'safety'->>'verified')::boolean,false),
    'dietary',COALESCE(d->'dietary','[]'::jsonb)));
  END IF;
 EXCEPTION WHEN OTHERS THEN
  NEW.dish_safety:=NULL;
 END;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.order_item_snapshot_safety() FROM PUBLIC;
DROP TRIGGER IF EXISTS order_item_snapshot_safety ON order_items;
CREATE TRIGGER order_item_snapshot_safety BEFORE INSERT ON order_items
 FOR EACH ROW EXECUTE FUNCTION app_private.order_item_snapshot_safety();

-- Kitchen snapshots now carry the snapshot (and the intake source) to the cards.
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
   'dishSafety',i.dish_safety,'intakeSource',o.intake_source,
   'status',w.status,'version',w.version,'releasedAt',w.released_at,'createdAt',w.created_at,'updatedAt',w.updated_at) AS payload,w.created_at,w.id
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

CREATE OR REPLACE FUNCTION app_private.kitchen_expo_snapshot(p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.kitchen_access(p_outlet) OR NOT app_private.can_outlet(p_outlet,'orders.complete')
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT jsonb_build_object(
  'cursor',COALESCE((SELECT last_seq FROM kitchen_event_counters WHERE outlet_id=p_outlet),0),
  'overflow',(SELECT COUNT(*)>60 FROM orders o WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing')
    AND EXISTS(SELECT 1 FROM kitchen_work w WHERE w.order_id=o.id AND w.status<>'cancelled')),
  'orders',COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',q.id,'orderNumber',q.order_number,'status',q.status,'version',q.version,
    'fulfillmentMode',q.fulfillment_mode,'tableLabel',q.table_label,'orderNotes',q.notes,
    'total',q.total,'done',q.done,'released',q.released,'started',q.started,'createdAt',q.created_at,
    'items',COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'workId',w.id,'version',w.version,'stationId',w.station_id,'stationName',s.name,
        'dishName',i.item_name,'quantity',i.quantity,'variantName',i.variant_name,
        'selectedOptions',i.selected_options,'notes',i.notes,'dishSafety',i.dish_safety,'status',w.status,
        'releasedAt',w.released_at) ORDER BY w.created_at,w.id)
      FROM kitchen_work w JOIN order_items i ON i.id=w.order_item_id
      JOIN kitchen_stations s ON s.outlet_id=w.outlet_id AND s.id=w.station_id
      WHERE w.order_id=q.id AND w.outlet_id=p_outlet AND w.status<>'cancelled'),'[]'::jsonb))
    ORDER BY q.created_at,q.id)
   FROM (SELECT o.id,o.order_number,o.status,o.version,o.fulfillment_mode,o.notes,
     t.table_number AS table_label,o.created_at,
     COUNT(w.id) FILTER (WHERE w.status<>'cancelled')::integer AS total,
     COUNT(w.id) FILTER (WHERE w.status='complete')::integer AS done,
     COUNT(w.id) FILTER (WHERE w.status='complete' AND w.released_at IS NOT NULL)::integer AS released,
     COUNT(w.id) FILTER (WHERE w.status='preparing')::integer AS started
     FROM orders o JOIN kitchen_work w ON w.order_id=o.id AND w.outlet_id=p_outlet
     LEFT JOIN restaurant_tables t ON t.id=o.table_id
     WHERE o.restaurant_id=p_outlet AND o.status IN ('accepted','preparing')
     GROUP BY o.id,t.table_number
     HAVING COUNT(w.id) FILTER (WHERE w.status<>'cancelled')>0
     ORDER BY o.created_at,o.id LIMIT 60) q),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END $$;
