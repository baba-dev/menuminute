-- Service Counter: exact ticket-set kitchen lookup. The previous legacy helper capped results
-- at 100 and could mislabel tickets in a 400-order rail. Do not alter historic migration files.
-- No ordering, entitlement, status-transition or Kitchen Pro release behavior changes.
CREATE FUNCTION app_private.kitchen_managed_orders_for_rail(p_outlet text, p_orders jsonb)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_outlet IS NULL
    OR p_orders IS NULL
    OR jsonb_typeof(p_orders) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_orders) > 400
    OR current_setting('app.outlet_id', true) IS DISTINCT FROM p_outlet
    OR NOT app_private.can_outlet(p_outlet, 'orders.read')
  THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(
    (SELECT jsonb_agg(m.order_id)
     FROM (SELECT DISTINCT w.order_id
           FROM kitchen_work w
           JOIN orders o ON o.id = w.order_id AND o.restaurant_id = p_outlet
           WHERE w.outlet_id = p_outlet
             AND w.order_id IN (SELECT jsonb_array_elements_text(p_orders))
             AND o.status IN ('accepted', 'preparing', 'ready')) m),
    '[]'::jsonb
  );
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_managed_orders_for_rail(text, jsonb)
  FROM PUBLIC, menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_managed_orders_for_rail(text, jsonb)
  TO menuminute_app;
