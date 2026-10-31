-- Seed a few open guest service calls (call server, water refill, bill request) on the live demo orders.
-- seed_demo_orders is replaced with a superset of its 0060 behaviour; reset_demo_outlet already deletes
-- guest_service_requests before seeding. Forward-only.
CREATE OR REPLACE FUNCTION app_private.seed_demo_orders(p_orders jsonb) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  o CONSTANT text := 'demo-outlet';
  ord jsonb; itm jsonb; ev jsonb; step text; tz text; cur text;
  created timestamptz; bdate date; total bigint; n integer := 0; live boolean; prev text; ver integer; reqs integer := 0;
BEGIN
  IF NOT EXISTS(SELECT 1 FROM restaurants WHERE id=o AND is_demo_data) THEN
    RAISE EXCEPTION 'Demo outlet is not provisioned' USING ERRCODE='42501';
  END IF;
  SELECT timezone INTO tz FROM restaurants WHERE id=o;
  PERFORM set_config('app.actor_id','demo-manager',true);
  FOR ord IN SELECT * FROM jsonb_array_elements(p_orders) LOOP
    created:=clock_timestamp()-make_interval(mins=>(ord->>'minutesAgo')::integer);
    bdate:=(created AT TIME ZONE tz)::date;
    SELECT COALESCE(sum((i->>'quantity')::bigint*(i->>'unitPriceMinor')::bigint),0) INTO total
    FROM jsonb_array_elements(ord->'items') i;
    live:=COALESCE((ord->>'live')::boolean,false);
    INSERT INTO orders(id,restaurant_id,table_id,customer_name,fulfillment_mode,status,payment_status,currency,
      subtotal_minor,tax_minor,total_minor,subtotal_paise,tax_paise,total_paise,order_number,created_at,updated_at,
      tracking_token,expires_at,business_date,intake_source,version,rejection_reason,notes)
    VALUES(ord->>'id',o,NULLIF(ord->>'tableId',''),ord->>'customerName',ord->>'mode',
      CASE WHEN live THEN 'pending' ELSE ord->>'status' END,
      CASE WHEN ord->>'paymentStatus' IN ('paid','voided') AND NOT live THEN ord->>'paymentStatus' ELSE 'unpaid' END,
      'INR',total,0,total,total,0,total,(ord->>'number')::integer,created,created,
      'trk-'||(ord->>'id'),
      CASE WHEN live THEN clock_timestamp()+interval '25 minutes' ELSE created+interval '2 hours' END,
      bdate,COALESCE(ord->>'intake','guest_menu'),1,NULLIF(ord->>'rejection',''),NULLIF(ord->>'notes',''));
    FOR itm IN SELECT * FROM jsonb_array_elements(ord->'items') LOOP
      INSERT INTO order_items(id,order_id,restaurant_id,menu_item_id,dish_id,variant_id,item_name,variant_name,
        selected_options,unit_price_minor,total_minor,unit_price_paise,total_paise,quantity,notes)
      VALUES(gen_random_uuid()::text,ord->>'id',o,NULL,itm->>'dishId',NULLIF(itm->>'variantId',''),itm->>'dishName',
        NULLIF(itm->>'variantName',''),COALESCE(itm->'selectedOptions','[]'::jsonb),(itm->>'unitPriceMinor')::integer,
        (itm->>'quantity')::integer*(itm->>'unitPriceMinor')::integer,(itm->>'unitPriceMinor')::integer,
        (itm->>'quantity')::integer*(itm->>'unitPriceMinor')::integer,(itm->>'quantity')::integer,NULLIF(itm->>'notes',''));
    END LOOP;
    -- Recorded history: events as given. Live orders: progress through real UPDATEs below.
    prev:=NULL;
    IF NOT live THEN
      FOR ev IN SELECT * FROM jsonb_array_elements(COALESCE(ord->'events','[]'::jsonb)) LOOP
        INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id,created_at)
        VALUES(gen_random_uuid()::text,ord->>'id',o,NULLIF(ev->>'from',''),ev->>'to',ev->>'to',
          COALESCE(NULLIF(ev->>'note',''),'Status updated to '||(ev->>'to')),
          CASE WHEN ev->>'to'='pending' THEN 'guest' ELSE 'staff' END,
          CASE WHEN ev->>'to'='pending' THEN NULL ELSE 'demo-manager' END,
          clock_timestamp()-make_interval(mins=>(ev->>'minutesAgo')::integer));
      END LOOP;
      UPDATE orders SET updated_at=clock_timestamp()-make_interval(mins=>COALESCE((ord->>'updatedMinutesAgo')::integer,(ord->>'minutesAgo')::integer))
      WHERE id=ord->>'id';
    ELSE
      INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,created_at)
      VALUES(gen_random_uuid()::text,ord->>'id',o,NULL,'pending','pending','Order placed','guest',created);
      cur:='pending'; ver:=1;
      FOR step IN SELECT jsonb_array_elements_text(COALESCE(ord->'liveSteps','[]'::jsonb)) LOOP
        ver:=ver+1;
        UPDATE orders SET status=step,version=ver,updated_at=clock_timestamp() WHERE id=ord->>'id';
        INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
        VALUES(gen_random_uuid()::text,ord->>'id',o,cur,step,step,'Status updated to '||step,'staff','demo-manager');
        cur:=step;
      END LOOP;
      IF cur='preparing' THEN
        UPDATE kitchen_work SET status='preparing',version=version+1,updated_at=clock_timestamp()
        WHERE order_id=ord->>'id' AND outlet_id=o;
      ELSIF cur='ready' THEN
        UPDATE kitchen_work SET status='complete',version=version+1,updated_at=clock_timestamp()
        WHERE order_id=ord->>'id' AND outlet_id=o;
      END IF;
    END IF;
    -- A few open guest service calls on live dine-in orders so the floor view is alive.
    IF live AND NULLIF(ord->>'tableId','') IS NOT NULL AND reqs < 3 THEN
      reqs:=reqs+1;
      INSERT INTO guest_service_requests(id,organization_id,outlet_id,order_id,table_id,signal,status,requested_at,acknowledged_at,acknowledged_by)
      VALUES('demo-svc-'||reqs,'org-demo-outlet',o,ord->>'id',ord->>'tableId',
        (ARRAY['call_server','water_refill','bill_request'])[reqs],
        CASE WHEN reqs=3 THEN 'acknowledged' ELSE 'requested' END,
        clock_timestamp()-make_interval(mins=>GREATEST(1,(ord->>'minutesAgo')::integer-1)),
        CASE WHEN reqs=3 THEN clock_timestamp()-interval '1 minute' END,
        CASE WHEN reqs=3 THEN (SELECT id FROM users WHERE id='demo-manager') END);
    END IF;
    INSERT INTO app_private.order_counters(restaurant_id,business_date,last_order_number)
    VALUES(o,bdate,(ord->>'number')::integer)
    ON CONFLICT (restaurant_id,business_date)
    DO UPDATE SET last_order_number=GREATEST(app_private.order_counters.last_order_number,EXCLUDED.last_order_number);
    n:=n+1;
  END LOOP;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.seed_demo_orders(jsonb) FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;
