
-- 0084 Guest CRM: always available with live Ordering, Kitchen Pro or contracted Community grants.
-- No runtime rollout flag. Guest recognition never confers authorization or public tracking access.
CREATE TABLE crm_guests (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  organization_id text NOT NULL REFERENCES organizations(id),
  phone_e164 text NOT NULL CHECK (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  display_name text NOT NULL DEFAULT '' CHECK (length(display_name) <= 80),
  staff_notes text NOT NULL DEFAULT '' CHECK (length(staff_notes) <= 1000),
  marketing_consent boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  UNIQUE (organization_id,phone_e164),
  UNIQUE (organization_id,id)
);
CREATE TABLE crm_guest_orders (
  order_id text PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  organization_id text NOT NULL,
  outlet_id text NOT NULL,
  guest_id text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  FOREIGN KEY (organization_id,guest_id) REFERENCES crm_guests(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,outlet_id) REFERENCES restaurants(organization_id,id),
  FOREIGN KEY (outlet_id,order_id) REFERENCES orders(restaurant_id,id)
);
CREATE INDEX crm_guest_orders_guest_outlet_idx ON crm_guest_orders(guest_id,outlet_id);
CREATE INDEX crm_guests_org_recent_idx ON crm_guests(organization_id,updated_at DESC,id);
-- A suppression marker prevents an erased profile reappearing when historical orders are touched.
CREATE TABLE crm_erased_phones (
  organization_id text NOT NULL REFERENCES organizations(id),
  phone_digest text NOT NULL,
  erased_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (organization_id,phone_digest)
);
ALTER TABLE crm_guests ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_guest_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE crm_erased_phones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON crm_guests,crm_guest_orders,crm_erased_phones FROM PUBLIC,menuminute_app,menuminute_worker;

CREATE FUNCTION app_private.crm_entitled(p_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_private.entitlement_allowed(p_org,'ordering.new')
     OR app_private.entitlement_allowed(p_org,'kitchen.new')
     OR app_private.is_community_edition()
$$;
CREATE FUNCTION app_private.crm_can(p_outlet text,p_mode text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM restaurants r JOIN organizations org ON org.id=r.organization_id
 WHERE r.id=p_outlet AND r.is_active AND org.is_active
 AND current_setting('app.outlet_id',true)=p_outlet
 AND app_private.crm_entitled(r.organization_id)
 AND app_private.can_outlet(p_outlet,
   CASE WHEN p_mode='admin' THEN 'outlet.manage'
        WHEN p_mode='write' THEN 'orders.accept' ELSE 'orders.read' END))
$$;

-- Public checkout inputs can be national numbers; do not guess for unsupported countries.
-- E.164 entries work in every country; fallback national parsing is intentionally conservative.
CREATE FUNCTION app_private.crm_phone(p_input text,p_country text) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE digits text; prefix text;
BEGIN
  IF p_input IS NULL OR length(trim(p_input))=0 OR length(p_input)>32 THEN RETURN NULL; END IF;
  IF trim(p_input) ~ '^\+[1-9][0-9 ()-]{6,24}$' THEN
    digits:=regexp_replace(trim(p_input),'[^0-9]','','g');
    IF length(digits) BETWEEN 8 AND 15 THEN RETURN '+'||digits; END IF;
    RETURN NULL;
  END IF;
  digits:=regexp_replace(p_input,'[^0-9]','','g');
  prefix:=CASE upper(coalesce(p_country,''))
    WHEN 'IN' THEN '91' WHEN 'US' THEN '1' WHEN 'CA' THEN '1'
    WHEN 'GB' THEN '44' WHEN 'AU' THEN '61' WHEN 'NZ' THEN '64'
    WHEN 'AE' THEN '971' WHEN 'OM' THEN '968' WHEN 'SA' THEN '966'
    WHEN 'QA' THEN '974' WHEN 'KW' THEN '965' WHEN 'BH' THEN '973'
    WHEN 'SG' THEN '65' WHEN 'MY' THEN '60' WHEN 'ZA' THEN '27'
    WHEN 'DE' THEN '49' WHEN 'FR' THEN '33' WHEN 'NL' THEN '31'
    ELSE NULL END;
  IF prefix IS NULL OR p_input !~ '^[0-9 ()-]+$' THEN RETURN NULL; END IF;
  IF upper(p_country)='IN' AND length(digits)<>10 THEN RETURN NULL; END IF;
  IF upper(p_country) IN ('US','CA') AND length(digits)<>10 THEN RETURN NULL; END IF;
  digits:=regexp_replace(digits,'^0+','');
  IF length(prefix||digits) BETWEEN 8 AND 15 THEN RETURN '+'||prefix||digits; END IF;
  RETURN NULL;
END $$;

CREATE FUNCTION app_private.crm_sync_order() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org_id text; outlet_country text; phone text; guest_id text;
BEGIN
  SELECT r.organization_id,r.country INTO org_id,outlet_country FROM restaurants r WHERE r.id=NEW.restaurant_id;
  IF org_id IS NULL OR NOT app_private.crm_entitled(org_id) THEN RETURN NEW; END IF;
  phone:=app_private.crm_phone(NEW.customer_phone,outlet_country);
  IF TG_OP='UPDATE' THEN
    DELETE FROM crm_guest_orders WHERE order_id=NEW.id;
  END IF;
  IF phone IS NULL OR EXISTS (SELECT 1 FROM crm_erased_phones
    WHERE organization_id=org_id AND phone_digest=md5(org_id||':'||phone)) THEN RETURN NEW; END IF;
  INSERT INTO crm_guests(organization_id,phone_e164,display_name,first_seen_at)
  VALUES(org_id,phone,coalesce(left(NEW.customer_name,80),''),NEW.created_at)
  ON CONFLICT (organization_id,phone_e164) DO UPDATE SET
    display_name=CASE WHEN crm_guests.display_name='' THEN excluded.display_name ELSE crm_guests.display_name END,
    first_seen_at=LEAST(crm_guests.first_seen_at,excluded.first_seen_at),
    updated_at=clock_timestamp()
  RETURNING id INTO guest_id;
  INSERT INTO crm_guest_orders(order_id,organization_id,outlet_id,guest_id)
  VALUES(NEW.id,org_id,NEW.restaurant_id,guest_id)
  ON CONFLICT (order_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER crm_order_insert AFTER INSERT ON orders
FOR EACH ROW EXECUTE FUNCTION app_private.crm_sync_order();
CREATE TRIGGER crm_order_phone_changed AFTER UPDATE OF customer_phone ON orders
FOR EACH ROW WHEN (OLD.customer_phone IS DISTINCT FROM NEW.customer_phone)
EXECUTE FUNCTION app_private.crm_sync_order();

-- Idempotent POS wrapper: existing financially attested dispatch remains the source of truth.
-- Phone association is committed atomically with that command, including on replay.
CREATE FUNCTION app_private.crm_pos_submit(p_outlet text,p_key text,p_hash text,p_data jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_result jsonb; v_order orders%ROWTYPE; v_phone text; v_country text;
BEGIN
  v_result:=app_private.pos_submit_and_dispatch(p_outlet,p_key,p_hash,p_data);
  v_phone:=nullif(trim(coalesce(p_data->>'customerPhone','')),'');
  IF v_phone IS NULL THEN RETURN v_result; END IF;
  SELECT country INTO v_country FROM restaurants WHERE id=p_outlet;
  v_phone:=app_private.crm_phone(v_phone,v_country);
  IF v_phone IS NULL THEN RAISE EXCEPTION 'Invalid customer mobile number' USING ERRCODE='22023'; END IF;
  SELECT * INTO v_order FROM orders
  WHERE id=v_result->>'orderId' AND restaurant_id=p_outlet AND intake_source='staff_pos' FOR UPDATE;
  IF NOT FOUND OR (v_order.customer_phone IS NOT NULL AND v_order.customer_phone<>v_phone)
  THEN RAISE EXCEPTION 'POS guest association conflict' USING ERRCODE='40001'; END IF;
  IF v_order.customer_phone IS DISTINCT FROM v_phone THEN
    UPDATE orders SET customer_phone=v_phone WHERE id=v_order.id AND restaurant_id=p_outlet;
  END IF;
  RETURN v_result;
END $$;

CREATE FUNCTION app_private.crm_lookup(p_outlet text,p_phone text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_country text; v_phone text; result jsonb;
BEGIN
 IF NOT app_private.crm_can(p_outlet,'read') THEN RAISE EXCEPTION 'CRM access required' USING ERRCODE='42501'; END IF;
 SELECT organization_id,country INTO v_org,v_country FROM restaurants WHERE id=p_outlet;
 v_phone:=app_private.crm_phone(p_phone,v_country);
 IF v_phone IS NULL THEN RETURN NULL; END IF;
 SELECT jsonb_build_object('id',g.id,'name',g.display_name,'phone',g.phone_e164,
  'visits',coalesce(history.n,0),'lastVisit',history.last_at)
 INTO result FROM crm_guests g LEFT JOIN LATERAL (
  SELECT count(*)::int n,max(o.created_at) last_at
  FROM crm_guest_orders link JOIN orders o ON o.id=link.order_id AND o.restaurant_id=link.outlet_id
  WHERE link.guest_id=g.id AND link.outlet_id=p_outlet
   AND o.status NOT IN ('cancelled','rejected','expired')
 ) history ON true
 WHERE g.organization_id=v_org AND g.phone_e164=v_phone;
 RETURN result;
END $$;

CREATE FUNCTION app_private.crm_list(p_outlet text,p_query text,p_page int)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; result jsonb;
BEGIN
 IF NOT app_private.crm_can(p_outlet,'read') THEN RAISE EXCEPTION 'CRM access required' USING ERRCODE='42501'; END IF;
 IF length(coalesce(p_query,''))>80 OR p_page<0 OR p_page>1000
 THEN RAISE EXCEPTION 'Invalid CRM filters' USING ERRCODE='22023'; END IF;
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;
 SELECT jsonb_build_object('total',(SELECT count(*)::int FROM crm_guests
   WHERE organization_id=v_org AND (coalesce(p_query,'')='' OR display_name ILIKE '%'||p_query||'%' OR phone_e164 LIKE '%'||p_query||'%')),
   'items',coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.display_name,
   'phone',g.phone_e164,'visits',coalesce(history.n,0),'lastVisit',history.last_at)
   ORDER BY g.updated_at DESC,g.id),'[]'::jsonb)) INTO result
 FROM (SELECT id,display_name,phone_e164,updated_at FROM crm_guests
  WHERE organization_id=v_org AND (coalesce(p_query,'')='' OR display_name ILIKE '%'||p_query||'%' OR phone_e164 LIKE '%'||p_query||'%')
  ORDER BY updated_at DESC,id LIMIT 20 OFFSET (p_page*20)) g
 LEFT JOIN LATERAL (
  SELECT count(*)::int n,max(o.created_at) last_at
  FROM crm_guest_orders link JOIN orders o ON o.id=link.order_id AND o.restaurant_id=link.outlet_id
  WHERE link.guest_id=g.id AND link.outlet_id=p_outlet AND o.status NOT IN ('cancelled','rejected','expired')
 ) history ON true;
 RETURN result;
END $$;

CREATE FUNCTION app_private.crm_detail(p_outlet text,p_guest text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; result jsonb;
BEGIN
 IF NOT app_private.crm_can(p_outlet,'read') THEN RAISE EXCEPTION 'CRM access required' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;
 SELECT jsonb_build_object('id',g.id,'name',g.display_name,'phone',g.phone_e164,'notes',g.staff_notes,
  'marketingConsent',g.marketing_consent,'orders',coalesce((
   SELECT jsonb_agg(row ORDER BY (row->>'createdAt') DESC) FROM (
      SELECT jsonb_build_object('id',o.id,'number',o.order_number,'createdAt',o.created_at,
       'status',o.status,'paymentStatus',o.payment_status,'currency',o.currency,
       'totalMinor',o.total_minor::text) AS row
      FROM crm_guest_orders link JOIN orders o ON o.id=link.order_id
       AND o.restaurant_id=link.outlet_id
      WHERE link.guest_id=g.id AND link.outlet_id=p_outlet
      ORDER BY o.created_at DESC,o.id DESC LIMIT 20
   ) recent
  ),'[]'::jsonb))
 INTO result FROM crm_guests g WHERE g.organization_id=v_org AND g.id=p_guest;
 RETURN result;
END $$;

CREATE FUNCTION app_private.crm_save(p_outlet text,p_guest text,p_phone text,p_name text,p_notes text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_country text; v_phone text; guest crm_guests%ROWTYPE;
BEGIN
 IF NOT app_private.crm_can(p_outlet,'write') THEN RAISE EXCEPTION 'CRM edit permission required' USING ERRCODE='42501'; END IF;
 IF length(coalesce(p_name,''))>80 OR length(coalesce(p_notes,''))>1000
 THEN RAISE EXCEPTION 'Guest details too long' USING ERRCODE='22023'; END IF;
 SELECT organization_id,country INTO v_org,v_country FROM restaurants WHERE id=p_outlet;
 IF p_guest IS NULL THEN
   v_phone:=app_private.crm_phone(p_phone,v_country);
   IF v_phone IS NULL THEN RAISE EXCEPTION 'Valid mobile required' USING ERRCODE='22023'; END IF;
   IF EXISTS (SELECT 1 FROM crm_erased_phones WHERE organization_id=v_org AND phone_digest=md5(v_org||':'||v_phone))
   THEN RAISE EXCEPTION 'Guest has opted out of retention' USING ERRCODE='42501'; END IF;
   INSERT INTO crm_guests(organization_id,phone_e164,display_name,staff_notes)
   VALUES(v_org,v_phone,coalesce(p_name,''),coalesce(p_notes,''))
   ON CONFLICT (organization_id,phone_e164) DO UPDATE SET
    display_name=EXCLUDED.display_name,staff_notes=EXCLUDED.staff_notes,updated_at=clock_timestamp()
   RETURNING * INTO guest;
 ELSE
   UPDATE crm_guests SET display_name=coalesce(p_name,''),staff_notes=coalesce(p_notes,''),
     updated_at=clock_timestamp()
   WHERE id=p_guest AND organization_id=v_org RETURNING * INTO guest;
   IF NOT FOUND THEN RAISE EXCEPTION 'Guest not found' USING ERRCODE='22023'; END IF;
 END IF;
 RETURN jsonb_build_object('id',guest.id,'name',guest.display_name,'phone',guest.phone_e164);
END $$;

CREATE FUNCTION app_private.crm_erase(p_outlet text,p_guest text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_phone text;
BEGIN
 IF NOT app_private.crm_can(p_outlet,'admin') THEN RAISE EXCEPTION 'CRM administrator required' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;
 SELECT phone_e164 INTO v_phone FROM crm_guests WHERE organization_id=v_org AND id=p_guest FOR UPDATE;
 IF v_phone IS NULL THEN RETURN false; END IF;
 INSERT INTO crm_erased_phones(organization_id,phone_digest)
 VALUES(v_org,md5(v_org||':'||v_phone)) ON CONFLICT DO NOTHING;
 DELETE FROM crm_guests WHERE id=p_guest AND organization_id=v_org;
 RETURN true;
END $$;
-- Historical association is a one-time data migration; no prices, orders or receipts are changed.
INSERT INTO crm_guests(organization_id,phone_e164,display_name,first_seen_at)
SELECT organization_id,phone_e164,max(display_name),min(created_at)
FROM (
 SELECT r.organization_id,app_private.crm_phone(o.customer_phone,r.country) phone_e164,
  coalesce(left(o.customer_name,80),'') display_name,o.created_at
 FROM orders o JOIN restaurants r ON r.id=o.restaurant_id
 WHERE o.customer_phone IS NOT NULL AND
  (app_private.entitlement_allowed(r.organization_id,'ordering.new')
    OR app_private.entitlement_allowed(r.organization_id,'kitchen.new')
    OR app_private.is_community_edition())
) src WHERE phone_e164 IS NOT NULL GROUP BY organization_id,phone_e164
ON CONFLICT (organization_id,phone_e164) DO NOTHING;
INSERT INTO crm_guest_orders(order_id,organization_id,outlet_id,guest_id)
SELECT o.id,g.organization_id,o.restaurant_id,g.id
FROM orders o JOIN restaurants r ON r.id=o.restaurant_id
JOIN crm_guests g ON g.organization_id=r.organization_id
 AND g.phone_e164=app_private.crm_phone(o.customer_phone,r.country)
WHERE o.customer_phone IS NOT NULL
ON CONFLICT (order_id) DO NOTHING;

REVOKE ALL ON FUNCTION app_private.crm_entitled(text),app_private.crm_can(text,text),
 app_private.crm_phone(text,text),app_private.crm_sync_order(),
 app_private.crm_pos_submit(text,text,text,jsonb),app_private.crm_lookup(text,text),
 app_private.crm_list(text,text,integer),app_private.crm_detail(text,text),
 app_private.crm_save(text,text,text,text,text),app_private.crm_erase(text,text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.crm_pos_submit(text,text,text,jsonb),
 app_private.crm_lookup(text,text),app_private.crm_list(text,text,integer),
 app_private.crm_detail(text,text),app_private.crm_save(text,text,text,text,text),
 app_private.crm_erase(text,text) TO menuminute_app;
