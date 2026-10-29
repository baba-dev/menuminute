-- POS 2.0 H hardening: verified read projections for private finance tables.
-- The application role never receives direct SELECT privileges on finance ledgers.
CREATE FUNCTION app_private.pos_daily_kpis_v2(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_orders integer;v_paid bigint;v_refunds bigint;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'read')
     OR NOT app_private.can_outlet(p_outlet,'orders.read')
  THEN RAISE EXCEPTION 'POS reporting access denied' USING ERRCODE='42501'; END IF;
  WITH bounds AS (
    SELECT ((now() at time zone r.timezone)::date::timestamp at time zone r.timezone) AS start_at,
       (((now() at time zone r.timezone)::date+1)::timestamp at time zone r.timezone) AS end_at
    FROM restaurants r WHERE r.id=p_outlet
  )
  SELECT (SELECT count(*)::integer FROM orders o CROSS JOIN bounds b
            WHERE o.restaurant_id=p_outlet AND o.created_at>=b.start_at AND o.created_at<b.end_at),
         (SELECT coalesce(sum(coalesce(pb.total_minor,o.total_minor)::bigint),0)
            FROM orders o CROSS JOIN bounds b
            LEFT JOIN pos_sales s ON s.outlet_id=o.restaurant_id AND s.order_id=o.id
            LEFT JOIN pos_bills pb ON pb.outlet_id=o.restaurant_id AND pb.sale_id=s.id
            WHERE o.restaurant_id=p_outlet AND o.payment_status='paid'
              AND o.created_at>=b.start_at AND o.created_at<b.end_at),
         (SELECT coalesce(sum(ref.amount_minor),0)
            FROM pos_refunds ref CROSS JOIN bounds b
            WHERE ref.outlet_id=p_outlet AND ref.created_at>=b.start_at AND ref.created_at<b.end_at)
  INTO v_orders,v_paid,v_refunds;
  RETURN jsonb_build_object('totalOrders',v_orders,'totalSalesMinor',(v_paid-v_refunds)::text,
     'refundedMinor',v_refunds::text);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_daily_kpis_v2(text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_daily_kpis_v2(text) TO menuminute_app;

CREATE FUNCTION app_private.pos_register_v2(
  p_outlet text,p_filter jsonb,p_cursor_at timestamptz,p_cursor_id text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_period text:=p_filter->>'period';v_source text:=p_filter->>'source';
  v_status text:=p_filter->>'status';v_payment text:=p_filter->>'payment';
  v_search text:=coalesce(p_filter->>'search','');v_result jsonb;
BEGIN
  IF NOT app_private.pos_access(p_outlet,'read')
     OR NOT app_private.can_outlet(p_outlet,'orders.read')
  THEN RAISE EXCEPTION 'POS register access denied' USING ERRCODE='42501'; END IF;
  IF v_period NOT IN ('today','week','all')
     OR v_source NOT IN ('all','staff_pos','guest_menu','online','unknown')
     OR v_status NOT IN ('all','pending','accepted','preparing','ready','served',
        'collected','cancelled','rejected','expired')
     OR v_payment NOT IN ('all','paid','unpaid','voided')
     OR length(v_search)>80
  THEN RAISE EXCEPTION 'Invalid POS register filter' USING ERRCODE='22023'; END IF;
  WITH matching AS MATERIALIZED (
    SELECT o.*,CASE WHEN t.id IS NULL THEN null
      ELSE coalesce(t.label,'Table '||t.table_number) END AS service_point
    FROM orders o JOIN restaurants r ON r.id=o.restaurant_id
      LEFT JOIN restaurant_tables t ON t.id=o.table_id AND t.restaurant_id=o.restaurant_id
    WHERE o.restaurant_id=p_outlet
      AND (v_source='all' OR o.intake_source=v_source)
      AND (v_status='all' OR o.status=v_status)
      AND (v_payment='all' OR o.payment_status=v_payment)
      AND (v_period='all'
        OR (v_period='today' AND o.created_at>=
            ((now() at time zone r.timezone)::date::timestamp at time zone r.timezone)
          AND o.created_at<(((now() at time zone r.timezone)::date+1)::timestamp at time zone r.timezone))
        OR (v_period='week' AND o.created_at>=now()-interval '7 days'))
      AND (v_search='' OR position(lower(v_search) in lower(o.order_number::text))>0
        OR position(lower(v_search) in lower(coalesce(o.customer_name,'')))>0
        OR position(lower(v_search) in lower(coalesce(t.label,'')))>0
        OR EXISTS (SELECT 1 FROM order_items i WHERE i.restaurant_id=p_outlet
          AND i.order_id=o.id AND position(lower(v_search) in lower(i.item_name))>0))
  ), page AS (
    SELECT * FROM matching o WHERE p_cursor_at IS NULL OR o.created_at<p_cursor_at
      OR (o.created_at=p_cursor_at AND o.id<p_cursor_id)
    ORDER BY created_at DESC,id DESC LIMIT 11
  ), decorated AS (
    SELECT p.id,p.created_at,
      jsonb_build_object(
        'orderId',p.id,'orderNumber',p.order_number,'createdAt',p.created_at,
        'source',p.intake_source,'customerName',p.customer_name,'servicePoint',p.service_point,
        'fulfillmentMode',p.fulfillment_mode,'status',p.status,
        'paymentStatus',p.payment_status,'currency',p.currency,
        'totalMinor',coalesce(b.total_minor,p.total_minor)::text,'saleId',s.id,
        'paymentEvidence',CASE WHEN a.sale_id IS NOT NULL THEN 'staff_recorded'
          WHEN EXISTS (SELECT 1 FROM pos_tenders pt WHERE pt.outlet_id=p_outlet AND pt.sale_id=s.id)
            THEN 'finance_recorded' ELSE null END,
        'items',coalesce((SELECT jsonb_agg(jsonb_build_object(
           'name',i.item_name,'quantity',i.quantity,'variant',i.variant_name,
           'notes',i.notes,'totalMinor',i.total_minor) ORDER BY i.id)
           FROM order_items i WHERE i.restaurant_id=p_outlet AND i.order_id=p.id),'[]'::jsonb)
      ) AS obj
    FROM page p LEFT JOIN pos_sales s ON s.outlet_id=p_outlet AND s.order_id=p.id
      LEFT JOIN pos_bills b ON b.outlet_id=p_outlet AND b.sale_id=s.id
      LEFT JOIN pos_staff_payment_attestations a ON a.outlet_id=p_outlet AND a.sale_id=s.id
  )
  SELECT jsonb_build_object('items',coalesce(
       (SELECT jsonb_agg(obj ORDER BY created_at DESC,id DESC) FROM decorated),'[]'::jsonb),
       'total',(SELECT count(*)::integer FROM matching)) INTO v_result;
  RETURN v_result;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_register_v2(text,jsonb,timestamptz,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.pos_register_v2(text,jsonb,timestamptz,text) TO menuminute_app;
