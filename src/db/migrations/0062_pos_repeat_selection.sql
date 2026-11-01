-- Read-only repeat-order snapshot for the POS cashier. A repeat is a new draft,
-- never a payment, sale, or order. Current availability/prices are rechecked by POS.
CREATE FUNCTION app_private.pos_repeat_selection(p_outlet text, p_order text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'read')
    OR NOT app_private.can_outlet(p_outlet,'orders.read')
  THEN RAISE EXCEPTION 'POS repeat access denied' USING ERRCODE='42501'; END IF;

  SELECT jsonb_build_object(
    'orderId',o.id,
    'items',coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'dishId',i.dish_id,
        'variantId',i.variant_id,
        'quantity',i.quantity,
        'selectedOptions',i.selected_options
      ) ORDER BY i.id)
      FROM order_items i
      WHERE i.restaurant_id=p_outlet AND i.order_id=o.id
    ),'[]'::jsonb)
  ) INTO v_result
  FROM orders o WHERE o.restaurant_id=p_outlet AND o.id=p_order;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Order unavailable' USING ERRCODE='22023';
  END IF;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_repeat_selection(text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_repeat_selection(text,text) TO menuminute_app;
