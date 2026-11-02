-- Floor context: show the diner's chosen name beside a table's service request so staff greet the
-- right person ("Table 7 · Asha · bill request"). Forward-only, after 0101. Same authorization and
-- scoping as 0092; the only change is one extra read-only field from the order the diner supplied.
-- Rollback: redeploy the 0092 definition; the UI treats a missing customerName as no name.
CREATE OR REPLACE FUNCTION app_private.staff_service_requests(p_org text,p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'orders.read')
 OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
  'id',q.id,'orderNumber',q.order_number,'tableNumber',q.table_number,
  'customerName',q.customer_name,
  'signal',q.signal,'status',q.status,'requestedAt',q.requested_at,
  'acknowledgedAt',q.acknowledged_at) ORDER BY q.requested_at DESC),'[]'::jsonb)
 INTO result FROM (
   SELECT s.id,o.order_number,left(o.customer_name,80) AS customer_name,t.table_number,
          s.signal,s.status,s.requested_at,s.acknowledged_at
   FROM guest_service_requests s
   LEFT JOIN orders o ON o.id=s.order_id AND o.restaurant_id=p_outlet
   JOIN restaurant_tables t ON t.id=s.table_id AND t.restaurant_id=p_outlet
   WHERE s.outlet_id=p_outlet AND s.organization_id=p_org
     AND s.status <> 'resolved'
   ORDER BY s.requested_at ASC LIMIT 100
 ) q;
 RETURN result;
END $fn$;
