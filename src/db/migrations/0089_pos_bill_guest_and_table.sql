-- Enrich authenticated operational POS bills with data already associated with the order.
-- Keep immutable issued tax/fiscal documents untouched: those reprint from their issued snapshot.
-- The existing v2 function remains the authorized entry point and preserves payment/refund fields.
CREATE OR REPLACE FUNCTION app_private.pos_receipt_data_v2(p_outlet text,p_sale text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_data jsonb; v_refund pos_staff_refunds%ROWTYPE;
 v_name text; v_phone text; v_table_number text; v_table_label text;
BEGIN
  -- This enforces the existing outlet-scoped POS-read permission and rejects unknown sales.
  v_data:=app_private.pos_receipt_data(p_outlet,p_sale);
  SELECT
    COALESCE(NULLIF(btrim(o.customer_name),''),NULLIF(btrim(g.display_name),'')),
    NULLIF(btrim(o.customer_phone),''),
    CASE WHEN o.fulfillment_mode='dine_in' THEN
      COALESCE(t.display_number::text,
        CASE WHEN t.table_number ~ '^[0-9]{1,4}$' THEN t.table_number END)
    END,
    CASE WHEN o.fulfillment_mode='dine_in' THEN
      COALESCE(NULLIF(btrim(t.name),''),NULLIF(btrim(t.label),''))
    END
  INTO v_name,v_phone,v_table_number,v_table_label
  FROM pos_sales s
  JOIN orders o ON o.id=s.order_id AND o.restaurant_id=s.outlet_id
  LEFT JOIN restaurant_tables t ON t.id=o.table_id AND t.restaurant_id=s.outlet_id
  LEFT JOIN crm_guest_orders go ON go.order_id=o.id AND go.outlet_id=s.outlet_id
    AND go.organization_id=s.organization_id
  LEFT JOIN crm_guests g ON g.id=go.guest_id AND g.organization_id=s.organization_id
  WHERE s.id=p_sale AND s.outlet_id=p_outlet;

  v_data:=v_data || jsonb_build_object(
    'customerName',v_name,
    'customerPhone',v_phone,
    'tableNumber',v_table_number,
    'tableLabel',v_table_label
  );
  SELECT * INTO v_refund FROM pos_staff_refunds
  WHERE outlet_id=p_outlet AND sale_id=p_sale;
  IF FOUND THEN
    RETURN v_data || jsonb_build_object('paymentStatus','refunded','refundRecorded',true);
  END IF;
  RETURN v_data || jsonb_build_object('refundRecorded',false);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_receipt_data_v2(text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_receipt_data_v2(text,text) TO menuminute_app;
