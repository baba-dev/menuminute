-- Service Counter: exact ticket-set kitchen lookup. The previous legacy helper capped results
-- at 100 and could mislabel tickets in a 400-order rail. Do not alter historic migration files.
-- No ordering, entitlement, status-transition or Kitchen Pro release behavior changes.
CREATE FUNCTION app_private.kitchen_managed_orders_for_rail(p_outlet text, p_orders text[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_outlet IS NULL
    OR p_orders IS NULL
    OR cardinality(p_orders) > 400
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
             AND w.order_id = ANY(p_orders)
             AND o.status IN ('accepted', 'preparing', 'ready')) m),
    '[]'::jsonb
  );
END $$;
REVOKE ALL ON FUNCTION app_private.kitchen_managed_orders_for_rail(text, text[])
  FROM PUBLIC, menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.kitchen_managed_orders_for_rail(text, text[])
  TO menuminute_app;
