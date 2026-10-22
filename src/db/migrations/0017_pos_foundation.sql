-- POS A/B/C: append-only, feature-disabled draft order and pre-fiscal sale foundation.
-- No tender capture, invoice issuance, tax-default assumption or legacy paid backfill.
CREATE TABLE pos_outlet_settings (
  organization_id text NOT NULL,
  outlet_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT false,
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE pos_seller_profiles (
  organization_id text NOT NULL,
  outlet_id text PRIMARY KEY,
  legal_name text NOT NULL CHECK(length(btrim(legal_name)) BETWEEN 2 AND 160),
  registered_address text NOT NULL CHECK(length(btrim(registered_address)) BETWEEN 5 AND 500),
  country text NOT NULL CHECK(country ~ '^[A-Z]{2}$'),
  tax_regime text NOT NULL DEFAULT 'unconfigured' CHECK(tax_regime IN ('unconfigured','not_registered','requires_review')),
  tax_registration text CHECK(length(tax_registration)<=64),
  revision integer NOT NULL DEFAULT 1 CHECK(revision>0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT
);
CREATE TABLE pos_sales (
  id text PRIMARY KEY,
  organization_id text NOT NULL,
  outlet_id text NOT NULL,
  order_id text NOT NULL,
  origin text NOT NULL CHECK(origin IN ('staff','existing_order')),
  state text NOT NULL DEFAULT 'order_submitted' CHECK(state IN ('order_submitted','cancelled')),
  currency text NOT NULL CHECK(length(currency)=3),
  subtotal_minor bigint NOT NULL CHECK(subtotal_minor>=0),
  tax_state text NOT NULL DEFAULT 'not_calculated' CHECK(tax_state='not_calculated'),
  actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT,
  UNIQUE (outlet_id,id),
  UNIQUE (outlet_id,order_id)
);
ALTER TABLE orders ADD CONSTRAINT orders_outlet_id_pos_unique UNIQUE (restaurant_id,id);
ALTER TABLE pos_sales ADD CONSTRAINT pos_sale_order_scope
 FOREIGN KEY (outlet_id,order_id) REFERENCES orders(restaurant_id,id) ON DELETE RESTRICT;
CREATE INDEX pos_sales_scope_time ON pos_sales(outlet_id,created_at DESC,id DESC);
CREATE TABLE pos_sale_lines (
  id text PRIMARY KEY,
  outlet_id text NOT NULL,
  sale_id text NOT NULL,
  order_item_id text NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  name_snapshot text NOT NULL,
  variant_snapshot text,
  options_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  quantity integer NOT NULL CHECK(quantity>0),
  unit_minor bigint NOT NULL CHECK(unit_minor>=0),
  line_minor bigint NOT NULL CHECK(line_minor>=0 AND line_minor=unit_minor*quantity::bigint),
  FOREIGN KEY (outlet_id,sale_id) REFERENCES pos_sales(outlet_id,id) ON DELETE RESTRICT,
  UNIQUE(sale_id,order_item_id)
);
CREATE TABLE pos_commands (
  organization_id text NOT NULL,
  outlet_id text NOT NULL,
  actor_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  request_key text NOT NULL CHECK(request_key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  request_hash text NOT NULL CHECK(request_hash ~ '^[0-9a-f]{64}$'),
  action text NOT NULL CHECK(action IN ('submit_order','attach_order')),
  result jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(organization_id,outlet_id,actor_id,request_key),
  FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT
);
CREATE INDEX pos_commands_time ON pos_commands(outlet_id,created_at DESC);
-- No direct access for the web/worker roles; SECURITY DEFINER functions expose bounded scoped commands.
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['pos_outlet_settings','pos_seller_profiles','pos_sales','pos_sale_lines','pos_commands'] LOOP
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,menuminute_app,menuminute_worker',t);
 END LOOP;
END $$;

-- Independent operational authorization: subscription billing.manage remains OWNER only.
CREATE FUNCTION app_private.pos_access(p_outlet text,p_action text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS (
 SELECT 1 FROM restaurants r JOIN organizations o ON o.id=r.organization_id
 JOIN organization_members m ON m.organization_id=o.id
 LEFT JOIN outlet_grants g ON g.organization_id=o.id AND g.outlet_id=r.id AND g.member_id=m.id
 WHERE r.id=p_outlet AND r.is_active AND o.is_active AND m.is_active
 AND m.user_id=NULLIF(current_setting('app.actor_id',true),'')
 AND current_setting('app.outlet_id',true)=p_outlet
 AND CASE
   WHEN p_action='configure' THEN m.role IN ('owner','admin')
   WHEN p_action='sale' THEN m.role IN ('owner','admin') OR (m.role='member' AND g.roles && ARRAY['manager','service']::text[])
   WHEN p_action='read' THEN m.role IN ('owner','admin') OR (m.role='member' AND g.roles && ARRAY['manager','service']::text[])
   ELSE false END)
$$;
REVOKE ALL ON FUNCTION app_private.pos_access(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_access(text,text) TO menuminute_app;

CREATE FUNCTION app_private.pos_context(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; s pos_outlet_settings%ROWTYPE; p pos_seller_profiles%ROWTYPE; token text; t jsonb;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet;
 SELECT * INTO s FROM pos_outlet_settings WHERE outlet_id=p_outlet;
 SELECT * INTO p FROM pos_seller_profiles WHERE outlet_id=p_outlet;
 SELECT destination_token INTO token FROM qr_codes
  WHERE restaurant_id=p_outlet AND is_active ORDER BY created_at,id LIMIT 1;
 SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'label',COALESCE(label,'Table '||table_number))
 ORDER BY table_number,id),'[]'::jsonb) INTO t FROM restaurant_tables
 WHERE restaurant_id=p_outlet AND is_active;
 RETURN jsonb_build_object('organizationId',r.organization_id,'enabled',COALESCE(s.enabled,false),'revision',COALESCE(s.revision,0),
  'canConfigure',app_private.pos_access(p_outlet,'configure'),
  'seller',CASE WHEN p.outlet_id IS NULL THEN NULL ELSE jsonb_build_object('legalName',p.legal_name,
  'registeredAddress',p.registered_address,'country',p.country,'taxRegime',p.tax_regime,
  'taxRegistration',p.tax_registration,'revision',p.revision) END,
  'currency',r.currency,'country',r.country,'fulfillmentModes',r.fulfillment_modes,'outletName',r.name,'token',token,'tables',t);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_context(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_context(text) TO menuminute_app;

CREATE FUNCTION app_private.pos_configure(p_outlet text,p_expected integer,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; s pos_outlet_settings%ROWTYPE; p pos_seller_profiles%ROWTYPE; new_revision integer;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'configure') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet FOR SHARE;
 SELECT * INTO s FROM pos_outlet_settings WHERE outlet_id=p_outlet FOR UPDATE;
 IF COALESCE(s.revision,0)<>p_expected THEN RAISE EXCEPTION 'Stale POS settings' USING ERRCODE='40001'; END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object'
  OR length(btrim(COALESCE(p_data->>'legalName',''))) NOT BETWEEN 2 AND 160
  OR length(btrim(COALESCE(p_data->>'registeredAddress',''))) NOT BETWEEN 5 AND 500
  OR p_data->>'country' IS DISTINCT FROM r.country
  OR p_data->>'taxRegime' NOT IN ('unconfigured','not_registered','requires_review')
  OR length(COALESCE(p_data->>'taxRegistration',''))>64
  OR jsonb_typeof(p_data->'enabled') IS DISTINCT FROM 'boolean'
 THEN RAISE EXCEPTION 'Invalid seller profile' USING ERRCODE='22023'; END IF;
 INSERT INTO pos_seller_profiles(organization_id,outlet_id,legal_name,registered_address,country,tax_regime,tax_registration)
 VALUES(r.organization_id,p_outlet,btrim(p_data->>'legalName'),btrim(p_data->>'registeredAddress'),
 r.country,p_data->>'taxRegime',NULLIF(btrim(p_data->>'taxRegistration'),''))
 ON CONFLICT(outlet_id) DO UPDATE SET legal_name=excluded.legal_name,registered_address=excluded.registered_address,
 tax_regime=excluded.tax_regime,tax_registration=excluded.tax_registration,
 revision=pos_seller_profiles.revision+1,updated_at=now();
 INSERT INTO pos_outlet_settings(organization_id,outlet_id,enabled,revision)
 VALUES(r.organization_id,p_outlet,(p_data->>'enabled')::boolean,1)
 ON CONFLICT(outlet_id) DO UPDATE SET enabled=excluded.enabled,
 revision=pos_outlet_settings.revision+1,updated_at=now() RETURNING revision INTO new_revision;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,current_setting('app.actor_id',true),'pos.settings',
  jsonb_build_object('outletId',p_outlet,'enabled',(p_data->>'enabled')::boolean,'revision',new_revision));
 RETURN jsonb_build_object('revision',new_revision,'enabled',(p_data->>'enabled')::boolean);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_configure(text,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_configure(text,integer,jsonb) TO menuminute_app;

-- A feature-flagged STAFF submission. Recompute every canonical price in SQL from released
-- menu JSON rather than trusting browser/HTTP-provided quote figures.
CREATE FUNCTION app_private.pos_submit_order(p_outlet text,p_key text,p_hash text,p_data jsonb)
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
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM pos_outlet_settings WHERE outlet_id=p_outlet AND enabled)
 THEN RAISE EXCEPTION 'POS not enabled' USING ERRCODE='42501'; END IF;
 IF p_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR p_hash !~ '^[0-9a-f]{64}$' OR jsonb_typeof(p_data) IS DISTINCT FROM 'object'
 THEN RAISE EXCEPTION 'Invalid POS request' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pos:'||p_outlet||':'||actor||':'||p_key,0));
 SELECT * INTO prior FROM pos_commands WHERE organization_id=r.organization_id AND outlet_id=p_outlet
  AND actor_id=actor AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
  IF prior.action<>'submit_order' OR prior.request_hash<>p_hash THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
  RETURN prior.result;
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
 -- First verify all lines before any business insert.
 FOR line IN SELECT value FROM jsonb_array_elements(p_data->'lines') LOOP
   qty:=(line->>'quantity')::integer;
   IF qty NOT BETWEEN 1 AND 99 OR jsonb_typeof(line->'groups') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'Invalid quantity/options' USING ERRCODE='22023'; END IF;
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
 clock_timestamp()+interval '2 hours');
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
    unit_price_minor,total_minor,unit_price_paise,total_paise,quantity)
   VALUES(item_id,order_id,p_outlet,line->>'dishId',NULLIF(line->>'variantId',''),dish->>'name',v_variant_name,v_options,
    unit_price::integer,line_price::integer,unit_price::integer,line_price::integer,qty);
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
REVOKE ALL ON FUNCTION app_private.pos_submit_order(text,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_submit_order(text,text,text,jsonb) TO menuminute_app;

-- Attach an eligible existing order without recreating food or claiming it was paid.
CREATE FUNCTION app_private.pos_attach_order(p_outlet text,p_order text,p_key text,p_hash text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r restaurants%ROWTYPE; o orders%ROWTYPE; prev pos_commands%ROWTYPE; result jsonb;
 sale_id text; actor text:=NULLIF(current_setting('app.actor_id',true),'');
BEGIN
 IF NOT app_private.pos_access(p_outlet,'sale') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM restaurants WHERE id=p_outlet FOR SHARE;
 IF NOT EXISTS(SELECT 1 FROM pos_outlet_settings WHERE outlet_id=p_outlet AND enabled) THEN
 RAISE EXCEPTION 'POS not enabled' USING ERRCODE='42501'; END IF;
 IF p_key !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
 OR p_hash !~ '^[0-9a-f]{64}$' THEN RAISE EXCEPTION 'Invalid key' USING ERRCODE='22023'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('pos:'||p_outlet||':'||actor||':'||p_key,0));
 SELECT * INTO prev FROM pos_commands WHERE organization_id=r.organization_id AND outlet_id=p_outlet
 AND actor_id=actor AND request_key=p_key FOR UPDATE;
 IF FOUND THEN
 IF prev.action<>'attach_order' OR prev.request_hash<>p_hash THEN RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
 RETURN prev.result;
 END IF;
 SELECT * INTO o FROM orders WHERE id=p_order AND restaurant_id=p_outlet FOR UPDATE;
 IF NOT FOUND OR o.status NOT IN ('accepted','preparing','ready','served','collected')
 OR o.payment_status<>'unpaid' THEN RAISE EXCEPTION 'Order cannot be attached' USING ERRCODE='22023'; END IF;
 IF EXISTS(SELECT 1 FROM pos_sales WHERE outlet_id=p_outlet AND order_id=p_order)
 THEN RAISE EXCEPTION 'Order already attached to a POS sale' USING ERRCODE='40001'; END IF;
 sale_id:='sale-'||gen_random_uuid()::text;
 INSERT INTO pos_sales(id,organization_id,outlet_id,order_id,origin,currency,subtotal_minor,actor_id)
 VALUES(sale_id,r.organization_id,p_outlet,o.id,'existing_order',o.currency,o.subtotal_minor,actor);
 INSERT INTO pos_sale_lines(id,outlet_id,sale_id,order_item_id,name_snapshot,variant_snapshot,options_snapshot,quantity,unit_minor,line_minor)
 SELECT gen_random_uuid()::text,p_outlet,sale_id,id,item_name,variant_name,selected_options,quantity,unit_price_minor,total_minor
 FROM order_items WHERE restaurant_id=p_outlet AND order_id=o.id;
 INSERT INTO domain_audit(id,organization_id,actor_id,action,details)
 VALUES(gen_random_uuid()::text,r.organization_id,actor,'pos.order.attached',
 jsonb_build_object('saleId',sale_id,'orderId',o.id,'outletId',p_outlet,'taxState','not_calculated'));
 result:=jsonb_build_object('saleId',sale_id,'orderId',o.id,'orderNumber',o.order_number,
 'currency',o.currency,'subtotalMinor',o.subtotal_minor::text,'status',o.status,'taxAndFeesCalculated',false,'duplicate',false);
 INSERT INTO pos_commands(organization_id,outlet_id,actor_id,request_key,request_hash,action,result)
 VALUES(r.organization_id,p_outlet,actor,p_key,p_hash,'attach_order',result);
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION app_private.pos_attach_order(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_attach_order(text,text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.pos_recent_sales(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('saleId',s.id,'orderId',s.order_id,
 'orderNumber',o.order_number,'origin',s.origin,'currency',s.currency,'subtotalMinor',s.subtotal_minor::text,
 'status',o.status,'createdAt',s.created_at) ORDER BY s.created_at DESC,s.id DESC)
 FROM (SELECT * FROM pos_sales WHERE outlet_id=p_outlet ORDER BY created_at DESC,id DESC LIMIT 30) s
 JOIN orders o ON o.id=s.order_id AND o.restaurant_id=s.outlet_id),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_recent_sales(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_recent_sales(text) TO menuminute_app;

-- Recover an already-committed command before re-quoting a changed menu or after HTTP loss.
CREATE FUNCTION app_private.pos_lookup_command(p_outlet text,p_key text,p_hash text,p_action text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE existing pos_commands%ROWTYPE;
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO existing FROM pos_commands WHERE outlet_id=p_outlet AND
 actor_id=NULLIF(current_setting('app.actor_id',true),'') AND request_key=p_key;
 IF NOT FOUND THEN RETURN NULL; END IF;
 IF existing.request_hash<>p_hash OR existing.action<>p_action THEN
 RAISE EXCEPTION 'Key conflict' USING ERRCODE='40001'; END IF;
 RETURN existing.result || jsonb_build_object('duplicate',true);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_lookup_command(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_lookup_command(text,text,text,text) TO menuminute_app;

-- Bounded picker for eligible existing tickets; never exposes guest tracking capabilities.
CREATE FUNCTION app_private.pos_attachable_orders(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.pos_access(p_outlet,'read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('orderId',x.id,'orderNumber',x.order_number,
 'customerName',x.customer_name,'fulfillmentMode',x.fulfillment_mode,'status',x.status,
 'currency',x.currency,'subtotalMinor',x.subtotal_minor::text,'createdAt',x.created_at)
 ORDER BY x.created_at DESC,x.id DESC)
 FROM (SELECT o.* FROM orders o WHERE o.restaurant_id=p_outlet
 AND o.status IN ('accepted','preparing','ready','served','collected') AND o.payment_status='unpaid'
 AND NOT EXISTS(SELECT 1 FROM pos_sales s WHERE s.outlet_id=p_outlet AND s.order_id=o.id)
 ORDER BY o.created_at DESC,o.id DESC LIMIT 30) x),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.pos_attachable_orders(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.pos_attachable_orders(text) TO menuminute_app;
