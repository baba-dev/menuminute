-- POS per-dish notes.
-- Staff can attach a short instruction to each POS line ("less oil", "no onion").
-- It lands in order_items.notes, the same column guest orders already use, so the
-- kitchen ticket, Final Check, the POS order register and incoming-order views show
-- it with no further change. The note never affects pricing, the catalogue
-- fingerprint or the quote; it is validated here (string, max 200 characters) even
-- though the application schema also validates it. pos_sale_lines is deliberately
-- unchanged: receipts and finance documents do not carry kitchen instructions.
-- CREATE OR REPLACE keeps the existing grants; an application rollback is harmless
-- because older code never sends a note and older rows simply have none.
CREATE OR REPLACE FUNCTION app_private.pos_submit_order(p_outlet text,p_key text,p_hash text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; prior pos_commands%ROWTYPE; cat jsonb; m jsonb; doc jsonb;
 line jsonb; dish jsonb; category jsonb; variant jsonb; grp jsonb; picked jsonb; opt jsonb;
 override_row jsonb; qty integer; n integer; unit_price bigint; subtotal bigint:=0; line_price bigint;
 order_id text; sale_id text; item_id text; v_date date; v_number integer; v_table text;
 v_options jsonb; v_name text; v_variant_name text; v_base bigint; v_group_count integer;
 v_result jsonb; actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF NOT app_private.pos_access(p_outlet,'sale') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet AND is_published AND NOT is_demo_data FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'POS outlet unavailable' USING ERRCODE='42501'; END IF;
 PERFORM 1 FROM organizations WHERE id=r.organization_id FOR SHARE;
 IF NOT app_private.pos_access(p_outlet,'sale') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pos_outlet_settings WHERE outlet_id=p_outlet AND enabled)
 THEN RAISE EXCEPTION 'POS not enabled' USING ERRCODE='42501'; END IF;
 IF p_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR p_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_data) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Invalid POS request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pos:'||p_outlet||':'||actor||':'||p_key,0));
 SELECT * INTO prior FROM pos_commands WHERE organization_id=r.organization_id AND outlet_id=p_outlet
  AND actor_id=actor AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF prior.action<>'submit_order' OR prior.request_hash<>p_hash THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
  RETURN prior.result || jsonb_build_object('duplicate',true);
 END IF;
 IF p_data->>'fulfillmentMode' IS NULL OR p_data->>'fulfillmentMode' NOT IN ('dine_in','pickup')
 OR NOT (p_data->>'fulfillmentMode'=ANY(r.fulfillment_modes))
 OR jsonb_typeof(p_data->'lines') IS DISTINCT FROM 'array'
 OR jsonb_array_length(p_data->'lines') NOT BETWEEN 1 AND 50
 OR length(COALESCE(p_data->>'customerName',''))>80
 OR length(COALESCE(p_data->>'notes',''))>500
 THEN RAISE EXCEPTION 'Invalid POS order' USING ERRCODE='22023'; END IF;
 v_table:=NULLIF(p_data->>'tableId','');
 IF v_table IS NOT NULL AND (p_data->>'fulfillmentMode'<>'dine_in' OR
 NOT EXISTS(SELECT 1 FROM restaurant_tables WHERE id=v_table AND restaurant_id=p_outlet AND is_active))
 THEN RAISE EXCEPTION 'Invalid table' USING ERRCODE='22023'; END IF;
 SELECT app_private.free_menu_public(q.destination_token) INTO cat FROM qr_codes q
 WHERE q.restaurant_id=p_outlet AND q.destination_token=p_data->>'token' AND q.is_active LIMIT 1;
 IF cat IS NULL OR NOT (cat->'outlet'->>'versioned')::boolean
 OR md5((cat->'menus')::text) IS DISTINCT FROM p_data->>'catalogFingerprint'
 THEN RAISE EXCEPTION 'Published menu changed' USING ERRCODE='40001'; END IF;
 SELECT value INTO m FROM jsonb_array_elements(cat->'menus') WHERE value->>'id'=p_data->>'menuId'
 AND (value->>'revision')::integer=(p_data->>'revision')::integer;
 IF m IS NULL THEN RAISE EXCEPTION 'Published menu changed' USING ERRCODE='40001'; END IF;
 doc:=m->'document';
 IF doc->>'currency' IS DISTINCT FROM r.currency THEN RAISE EXCEPTION 'Currency mismatch' USING ERRCODE='22023'; END IF;
 -- The server separately checks item/menu schedules at quote time. Limit the short request-to-commit interval.
 IF p_data->>'quotedAt' IS NULL OR (p_data->>'quotedAt')::timestamptz < clock_timestamp()-interval '30 seconds'
 OR (p_data->>'quotedAt')::timestamptz>clock_timestamp()+interval '2 seconds'
 THEN RAISE EXCEPTION 'Stale POS quote' USING ERRCODE='40001'; END IF;
 IF p_data->>'expiresAt' IS NULL OR (p_data->>'expiresAt')::timestamptz<=clock_timestamp()
 OR (p_data->>'expiresAt')::timestamptz>clock_timestamp()+interval '2 hours'
 THEN RAISE EXCEPTION 'Invalid pending-order expiry' USING ERRCODE='22023'; END IF;
 -- First verify all lines before any business insert.
 FOR line IN SELECT value FROM jsonb_array_elements(p_data->'lines') LOOP
   qty:=(line->>'quantity')::integer;
   IF qty NOT BETWEEN 1 AND 99 OR jsonb_typeof(line->'groups') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'Invalid quantity/options' USING ERRCODE='22023'; END IF;
   -- Optional per-dish note (the guest-facing equivalent is order_items.notes, max 200).
   IF line ? 'note' AND (jsonb_typeof(line->'note') NOT IN ('string','null')
     OR length(COALESCE(line->>'note',''))>200)
   THEN RAISE EXCEPTION 'Invalid dish note' USING ERRCODE='22023'; END IF;
   SELECT i.value, c.value INTO dish,category FROM jsonb_array_elements(doc->'categories') c(value)
    CROSS JOIN LATERAL jsonb_array_elements(c.value->'items') i(value)
    WHERE i.value->>'id'=line->>'dishId' AND COALESCE((c.value->>'archived')::boolean,false)=false
    AND COALESCE((i.value->>'archived')::boolean,false)=false LIMIT 1;
   IF dish IS NULL OR COALESCE((dish->>'soldOut')::boolean,false) THEN RAISE EXCEPTION 'Dish unavailable' USING ERRCODE='40001'; END IF;
   SELECT value INTO override_row FROM jsonb_array_elements(COALESCE(m->'overrides','[]'::jsonb))
     WHERE value->>'dishId'=line->>'dishId' LIMIT 1;
   IF COALESCE((override_row->>'soldOut')::boolean,false) THEN RAISE EXCEPTION 'Dish unavailable' USING ERRCODE='40001'; END IF;
   v_variant_name:=NULL;
   IF jsonb_array_length(dish->'variants')>0 THEN
     SELECT value INTO variant FROM jsonb_array_elements(dish->'variants')
      WHERE value->>'id'=line->>'variantId' AND COALESCE((value->>'isAvailable')::boolean,true) LIMIT 1;
     IF variant IS NULL THEN RAISE EXCEPTION 'Invalid variant' USING ERRCODE='22023'; END IF;
     v_base:=(variant->>'priceMinor')::bigint; v_variant_name:=variant->>'name';
   ELSE
     IF line->>'variantId' IS NOT NULL THEN RAISE EXCEPTION 'Unexpected variant' USING ERRCODE='22023'; END IF;
     v_base:=COALESCE((override_row->>'priceMinor')::bigint,(dish->>'priceMinor')::bigint);
   END IF;
   unit_price:=v_base; v_options:='[]'::jsonb;
   IF EXISTS(SELECT 1 FROM jsonb_array_elements(line->'groups') chosen(value)
     WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(dish->'addOnGroups') valid(value)
       WHERE valid.value->>'id'=chosen.value->>'groupId')) THEN
     RAISE EXCEPTION 'Invalid add-on group' USING ERRCODE='22023'; END IF;
   FOR grp IN SELECT value FROM jsonb_array_elements(dish->'addOnGroups') LOOP
     SELECT value INTO picked FROM jsonb_array_elements(line->'groups') WHERE value->>'groupId'=grp->>'id' LIMIT 1;
     IF (SELECT count(*) FROM jsonb_array_elements(line->'groups') WHERE value->>'groupId'=grp->>'id')>1
     THEN RAISE EXCEPTION 'Duplicate group' USING ERRCODE='22023'; END IF;
     n:=COALESCE(jsonb_array_length(picked->'optionIds'),0);
     IF n<(grp->>'min')::integer OR n>(grp->>'max')::integer THEN RAISE EXCEPTION 'Add-on bounds' USING ERRCODE='22023'; END IF;
     IF (SELECT count(DISTINCT value) FROM jsonb_array_elements_text(COALESCE(picked->'optionIds','[]'::jsonb)))<>n
     THEN RAISE EXCEPTION 'Duplicate add-on' USING ERRCODE='22023'; END IF;
     FOR opt IN SELECT o.value FROM jsonb_array_elements(COALESCE(picked->'optionIds','[]'::jsonb)) choice(value)
       CROSS JOIN LATERAL jsonb_array_elements(grp->'options') o(value) WHERE o.value->>'id'=choice.value#>>'{}' LOOP
       IF NOT COALESCE((opt->>'isAvailable')::boolean,true) THEN RAISE EXCEPTION 'Add-on unavailable' USING ERRCODE='40001'; END IF;
       unit_price:=unit_price+(opt->>'priceMinor')::bigint;
       v_options:=v_options||jsonb_build_array(jsonb_build_object('groupId',grp->>'id','groupName',grp->>'name',
         'optionId',opt->>'id','optionName',opt->>'name','priceMinor',(opt->>'priceMinor')::integer));
     END LOOP;
     IF (SELECT count(*) FROM jsonb_array_elements(v_options) WHERE value->>'groupId'=grp->>'id')<>n
     THEN RAISE EXCEPTION 'Unknown add-on' USING ERRCODE='22023'; END IF;
     picked:=NULL;
   END LOOP;
   IF unit_price<0 OR unit_price>2147483647 OR unit_price*qty::bigint>2147483647
   THEN RAISE EXCEPTION 'Unsupported line amount' USING ERRCODE='22023'; END IF;
   subtotal:=subtotal+unit_price*qty::bigint;
   dish:=NULL; override_row:=NULL; variant:=NULL;
 END LOOP;
 IF subtotal>2147483647 OR subtotal::text IS DISTINCT FROM p_data->>'expectedSubtotalMinor'
 THEN RAISE EXCEPTION 'Quote changed' USING ERRCODE='40001'; END IF;
 order_id:='ord-'||gen_random_uuid()::text; sale_id:='sale-'||gen_random_uuid()::text;
 v_date:=(clock_timestamp() AT TIME ZONE r.timezone)::date;
 v_number:=app_private.next_order_number(p_outlet,v_date);
 INSERT INTO orders(id,restaurant_id,table_id,customer_name,fulfillment_mode,status,payment_status,currency,
 subtotal_minor,tax_minor,total_minor,subtotal_paise,tax_paise,total_paise,notes,business_date,order_number,version,expires_at)
 VALUES(order_id,p_outlet,v_table,NULLIF(p_data->>'customerName',''),p_data->>'fulfillmentMode','pending','unpaid',
 r.currency,subtotal,0,subtotal,subtotal,0,subtotal,NULLIF(p_data->>'notes',''),v_date,v_number,1,
 (p_data->>'expiresAt')::timestamptz);
 INSERT INTO pos_sales(id,organization_id,outlet_id,order_id,origin,currency,subtotal_minor,actor_id)
 VALUES(sale_id,r.organization_id,p_outlet,order_id,'staff',r.currency,subtotal,actor);
 -- Values re-read from the verified released catalogue: never copy a browser-supplied unit price.
 FOR line IN SELECT value FROM jsonb_array_elements(p_data->'lines') LOOP
   SELECT i.value INTO dish FROM jsonb_array_elements(doc->'categories') c(value)
   CROSS JOIN LATERAL jsonb_array_elements(c.value->'items') i(value) WHERE i.value->>'id'=line->>'dishId' LIMIT 1;
   SELECT value INTO override_row FROM jsonb_array_elements(COALESCE(m->'overrides','[]'::jsonb))
    WHERE value->>'dishId'=line->>'dishId' LIMIT 1;
   variant:=NULL; v_variant_name:=NULL; v_options:='[]'::jsonb;
   IF jsonb_array_length(dish->'variants')>0 THEN
     SELECT value INTO variant FROM jsonb_array_elements(dish->'variants')
     WHERE value->>'id'=line->>'variantId' LIMIT 1;
     unit_price:=(variant->>'priceMinor')::bigint; v_variant_name:=variant->>'name';
   ELSE unit_price:=COALESCE((override_row->>'priceMinor')::bigint,(dish->>'priceMinor')::bigint); END IF;
   FOR grp IN SELECT value FROM jsonb_array_elements(dish->'addOnGroups') LOOP
    SELECT value INTO picked FROM jsonb_array_elements(line->'groups') WHERE value->>'groupId'=grp->>'id' LIMIT 1;
    FOR opt IN SELECT o.value FROM jsonb_array_elements(COALESCE(picked->'optionIds','[]'::jsonb)) choice(value)
     CROSS JOIN LATERAL jsonb_array_elements(grp->'options') o(value) WHERE o.value->>'id'=choice.value#>>'{}' LOOP
       unit_price:=unit_price+(opt->>'priceMinor')::bigint;
       v_options:=v_options||jsonb_build_array(jsonb_build_object('groupId',grp->>'id','groupName',grp->>'name',
       'optionId',opt->>'id','optionName',opt->>'name','priceMinor',(opt->>'priceMinor')::integer));
    END LOOP;
    picked:=NULL;
   END LOOP;
   item_id:=gen_random_uuid()::text; qty:=(line->>'quantity')::integer; line_price:=unit_price*qty;
   INSERT INTO order_items(id,order_id,restaurant_id,dish_id,variant_id,item_name,variant_name,selected_options,
    unit_price_minor,total_minor,unit_price_paise,total_paise,quantity,notes)
   VALUES(item_id,order_id,p_outlet,line->>'dishId',NULLIF(line->>'variantId',''),dish->>'name',v_variant_name,v_options,
    unit_price::integer,line_price::integer,unit_price::integer,line_price::integer,qty,
    NULLIF(btrim(COALESCE(line->>'note','')),''));
   INSERT INTO pos_sale_lines(id,outlet_id,sale_id,order_item_id,name_snapshot,variant_snapshot,options_snapshot,quantity,unit_minor,line_minor)
   VALUES(gen_random_uuid()::text,p_outlet,sale_id,item_id,dish->>'name',v_variant_name,v_options,qty,unit_price,line_price);
   dish:=NULL; override_row:=NULL;
 END LOOP;
 INSERT INTO order_status_events(id,order_id,restaurant_id,from_status,to_status,status,note,actor_type,actor_id)
 VALUES(gen_random_uuid()::text,order_id,p_outlet,NULL,'pending','pending','Staff POS order','staff',actor);
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'pos.sale.created',
  jsonb_build_object('outletId',p_outlet,'saleId',sale_id,'orderId',order_id,'taxState','not_calculated'));
 INSERT INTO outbox_events(id,organization_id,outlet_id,type,schema_version,aggregate_version,payload)
 VALUES(gen_random_uuid()::text,r.organization_id,p_outlet,'order.created',1,1,
 jsonb_build_object('orderId',order_id,'orderNumber',v_number,'totalMinor',subtotal,'currency',r.currency));
 v_result:=jsonb_build_object('saleId',sale_id,'orderId',order_id,'orderNumber',v_number,
   'currency',r.currency,'subtotalMinor',subtotal::text,'status','pending','taxAndFeesCalculated',false,'duplicate',false);
 INSERT INTO pos_commands(organization_id,outlet_id,actor_id,request_key,request_hash,action,result)
 VALUES(r.organization_id,p_outlet,actor,p_key,p_hash,'submit_order',v_result);
 RETURN v_result;
END $$;
