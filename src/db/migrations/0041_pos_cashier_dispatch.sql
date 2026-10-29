-- POS 2.0 E: atomic staff dispatch and cashier acceptance of submitted customer orders.
-- Existing finance, document and Kitchen Pro activation gates remain unchanged.
CREATE FUNCTION app_private.pos_submit_and_dispatch(
  p_outlet text,p_key text,p_hash text,p_data jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE result jsonb; o orders%ROWTYPE; transition jsonb;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'sale')
    OR NOT app_private.can_outlet(p_outlet,'orders.accept')
  THEN RAISE EXCEPTION 'Order placement permission required' USING ERRCODE='42501'; END IF;
  result := app_private.pos_submit_order_with_attestation(p_outlet,p_key,p_hash,p_data);
  SELECT * INTO o FROM orders WHERE id=result->>'orderId' AND restaurant_id=p_outlet FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found' USING ERRCODE='22023'; END IF;
  IF o.status='pending' THEN
    transition := app_private.transition_order(p_outlet,o.id,'accepted',o.version,'');
  ELSIF o.status NOT IN ('accepted','preparing','ready','served','collected') THEN
    RAISE EXCEPTION 'Order cannot be dispatched' USING ERRCODE='40001';
  END IF;
  RETURN result || jsonb_build_object('status','accepted','dispatched',true);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_submit_and_dispatch(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_submit_and_dispatch(text,text,text,jsonb) TO menuminute_app;

CREATE FUNCTION app_private.pos_accept_customer_order(
  p_outlet text,p_order text,p_version integer,p_key text,p_hash text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o orders%ROWTYPE; linked pos_sales%ROWTYPE; prior jsonb; result jsonb;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'sale')
     OR NOT app_private.can_outlet(p_outlet,'orders.accept')
  THEN RAISE EXCEPTION 'Acceptance permission required' USING ERRCODE='42501'; END IF;
  IF p_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     OR p_version<1 THEN RAISE EXCEPTION 'Invalid POS acceptance' USING ERRCODE='22023'; END IF;
  prior:=app_private.pos_lookup_command(p_outlet,p_key,p_hash,'attach_order');
  IF prior IS NOT NULL THEN RETURN prior || jsonb_build_object('accepted',true); END IF;
  SELECT * INTO o FROM orders WHERE id=p_order AND restaurant_id=p_outlet FOR UPDATE;
  IF NOT FOUND OR o.intake_source NOT IN ('guest_menu','online')
  THEN RAISE EXCEPTION 'Customer order not found' USING ERRCODE='22023'; END IF;
  SELECT * INTO linked FROM pos_sales WHERE outlet_id=p_outlet AND order_id=p_order;
  IF FOUND THEN
    RETURN jsonb_build_object('orderId',o.id,'saleId',linked.id,'orderNumber',o.order_number,
      'status',o.status,'duplicate',true,'accepted',o.status<>'pending');
  END IF;
  IF o.status='pending' THEN
    IF o.version<>p_version THEN RAISE EXCEPTION 'Order changed; refresh' USING ERRCODE='40001'; END IF;
    PERFORM app_private.transition_order(p_outlet,p_order,'accepted',o.version,'');
  ELSIF o.status NOT IN ('accepted','preparing','ready','served','collected') THEN
    RAISE EXCEPTION 'Order cannot be accepted' USING ERRCODE='22023';
  END IF;
  -- Atomic with acceptance: if POS association fails, the kitchen transition rolls back.
  result:=app_private.pos_attach_order(p_outlet,p_order,p_key,p_hash);
  RETURN result || jsonb_build_object('accepted',true);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_accept_customer_order(text,text,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_accept_customer_order(text,text,integer,text,text) TO menuminute_app;
