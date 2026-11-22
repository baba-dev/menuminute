-- 0115: Tiffin & Home-Chef Hub phase 2 authoring commands (ADR 032). Adds guarded SECURITY DEFINER
-- functions over the 0114 tiffin_* tables and a restaurants currency guard. 0115 creates new objects
-- only: it never redefines an existing function (manage_organization, can_outlet and the 0003/0005
-- currency guards are untouched) and never changes a table, constraint, grant or RLS setting of 0114.
-- Authorization: every command first calls app_private.tiffin_can (outlet and organization active,
-- outlet_type='tiffin', app.outlet_id equals the selector, can_outlet menu.read/menu.write) and raises
-- 42501 'Not allowed' otherwise. Writes then take pg_advisory_xact_lock(hashtextextended('tiffin:'||
-- outlet,0)), re-check, validate the jsonb input in SQL (bounds equal the 0114 CHECKs and the Zod
-- schemas in src/modules/tiffin/contracts.ts; 22023 with a safe message), scope every lookup by
-- organization_id AND outlet_id, and write one audit_logs row in the same transaction. Missing and
-- foreign ids fail identically ('Combo not allowed'). A combo's currency is always the outlet's
-- restaurants.currency; a 201st non-archived combo per outlet is refused with 54000.
-- Weekday is EXTRACT(DOW): 0=Sunday..6=Saturday. A date override replaces that day's menu for its
-- slot: closed=true offers nothing, closed=false offers exactly its combos.
-- Grants: the six entry points are executable by menuminute_app only (not PUBLIC, not
-- menuminute_worker); internal helpers and the trigger function are executable by nobody but the owner.
-- Rollback: DROP TRIGGER tiffin_currency_guard ON restaurants; then DROP FUNCTION
-- app_private.guard_tiffin_currency(), tiffin_menu_read(text), tiffin_override_set(text,jsonb),
-- tiffin_week_set(text,jsonb), tiffin_combo_save(text,jsonb), tiffin_slot_save(text,jsonb),
-- tiffin_can(text,text), tiffin_audit(text,text,text,text,jsonb,jsonb), tiffin_combo_json(text,text,text),
-- tiffin_jdate(jsonb), tiffin_jids(jsonb), tiffin_jid(jsonb), tiffin_jlabel(jsonb,integer),
-- tiffin_jint(jsonb,bigint,bigint), tiffin_keys_ok(jsonb,text[]) (all in app_private). Data written
-- through these functions stays in the phase 1 tables; those tables are rolled back per the 0114 header.

-- ── Input helpers (pure, never raise; NULL means invalid) ─────────────────────────────────────────
CREATE FUNCTION app_private.tiffin_keys_ok(p jsonb,p_allowed text[]) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF p IS NULL OR jsonb_typeof(p)<>'object' THEN RETURN false; END IF;
 RETURN NOT EXISTS(SELECT 1 FROM jsonb_object_keys(p) k WHERE NOT (k=ANY(p_allowed)));
END $$;

CREATE FUNCTION app_private.tiffin_jint(v jsonb,p_lo bigint,p_hi bigint) RETURNS bigint
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n numeric;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'number' THEN RETURN NULL; END IF;
 n:=v::numeric;
 IF n<>trunc(n) OR n<p_lo OR n>p_hi THEN RETURN NULL; END IF;
 RETURN n::bigint;
END $$;

-- Mirrors z.string().trim().min(1).max(n): the trimmed value is validated and returned.
CREATE FUNCTION app_private.tiffin_jlabel(v jsonb,p_max integer) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s text;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'string' THEN RETURN NULL; END IF;
 s:=regexp_replace(v#>>'{}','^[[:space:]]+|[[:space:]]+$','','g');
 IF length(s) BETWEEN 1 AND p_max THEN RETURN s; END IF;
 RETURN NULL;
END $$;

-- Mirrors z.string().min(1).max(64) for ids.
CREATE FUNCTION app_private.tiffin_jid(v jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'string' THEN RETURN NULL; END IF;
 IF length(v#>>'{}') BETWEEN 1 AND 64 THEN RETURN v#>>'{}'; END IF;
 RETURN NULL;
END $$;

-- Mirrors the contracts idList: at most 50 unique ids, order preserved.
CREATE FUNCTION app_private.tiffin_jids(v jsonb) RETURNS text[]
LANGUAGE plpgsql IMMUTABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE ids text[];
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'array' THEN RETURN NULL; END IF;
 IF jsonb_array_length(v)>50 THEN RETURN NULL; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(v) x WHERE app_private.tiffin_jid(x) IS NULL) THEN RETURN NULL; END IF;
 SELECT COALESCE(array_agg(x#>>'{}' ORDER BY o),'{}'::text[]) INTO ids FROM jsonb_array_elements(v) WITH ORDINALITY t(x,o);
 IF cardinality(ids)<>(SELECT count(DISTINCT u) FROM unnest(ids) u) THEN RETURN NULL; END IF;
 RETURN ids;
END $$;

-- Mirrors the contracts localDate: YYYY-MM-DD and a real calendar date.
CREATE FUNCTION app_private.tiffin_jdate(v jsonb) RETURNS date
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s text; d date;
BEGIN
 IF v IS NULL OR jsonb_typeof(v)<>'string' THEN RETURN NULL; END IF;
 s:=v#>>'{}';
 IF s !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN NULL; END IF;
 BEGIN d:=s::date; EXCEPTION WHEN others THEN RETURN NULL; END;
 IF to_char(d,'YYYY-MM-DD')<>s THEN RETURN NULL; END IF;
 RETURN d;
END $$;

-- ── Internal definer helpers (owner only) ──────────────────────────────────────────────────────────
CREATE FUNCTION app_private.tiffin_combo_json(p_org text,p_outlet text,p_combo text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',c.id,'name',c.name,'description',c.description,
  'priceMinor',c.price_minor,'currency',c.currency,'archived',c.archived,
  'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'label',i.label,'quantity',i.quantity)
    ORDER BY i.created_at,i.id) FROM tiffin_combo_items i
    WHERE i.organization_id=c.organization_id AND i.outlet_id=c.outlet_id AND i.combo_id=c.id),'[]'::jsonb),
  'addons',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'priceMinor',a.price_minor)
    ORDER BY a.created_at,a.id) FROM tiffin_combo_addons a
    WHERE a.organization_id=c.organization_id AND a.outlet_id=c.outlet_id AND a.combo_id=c.id),'[]'::jsonb))
 FROM tiffin_combos c WHERE c.organization_id=p_org AND c.outlet_id=p_outlet AND c.id=p_combo
$$;

CREATE FUNCTION app_private.tiffin_audit(p_outlet text,p_action text,p_type text,p_resource text,
  p_before jsonb,p_after jsonb) RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 INSERT INTO audit_logs(id,user_id,restaurant_id,action,resource_type,resource_id,before,after)
 VALUES(gen_random_uuid()::text,NULLIF(current_setting('app.actor_id',true),''),p_outlet,p_action,p_type,
  p_resource,p_before::text,p_after::text)
$$;

-- ── Authorization ──────────────────────────────────────────────────────────────────────────────────
-- Fails closed: only 'read' and 'write' map to a permission; any other mode (or NULL) yields false
-- (the explicit IN check matters because can_outlet allows owners and admins any permission).
CREATE FUNCTION app_private.tiffin_can(p_outlet text,p_mode text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM restaurants r JOIN organizations o ON o.id=r.organization_id
 WHERE r.id=p_outlet AND r.is_active AND o.is_active AND r.outlet_type='tiffin'
 AND current_setting('app.outlet_id',true)=p_outlet AND p_mode IN ('read','write')
 AND app_private.can_outlet(p_outlet,CASE p_mode WHEN 'read' THEN 'menu.read' WHEN 'write' THEN 'menu.write' END))
$$;

-- ── Slots ──────────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION app_private.tiffin_slot_save(p_outlet text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_kind text; v_start integer; v_end integer; v_cutoff integer; v_capacity integer;
 v_enabled boolean; s tiffin_slots%ROWTYPE; v_before jsonb; v_after jsonb;
BEGIN
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tiffin:'||p_outlet,0));
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;

 IF NOT app_private.tiffin_keys_ok(p,ARRAY['kind','startMinute','endMinute','cutoffMinutesBefore','capacity','enabled'])
  OR NOT (p ? 'capacity') THEN RAISE EXCEPTION 'Invalid slot' USING ERRCODE='22023'; END IF;
 v_kind:=CASE WHEN jsonb_typeof(p->'kind')='string' AND p->>'kind' IN ('lunch','dinner') THEN p->>'kind' END;
 v_start:=app_private.tiffin_jint(p->'startMinute',0,1439);
 v_end:=app_private.tiffin_jint(p->'endMinute',1,1440);
 v_cutoff:=app_private.tiffin_jint(p->'cutoffMinutesBefore',0,10080);
 IF v_kind IS NULL OR v_start IS NULL OR v_end IS NULL OR v_cutoff IS NULL OR v_end<=v_start
  THEN RAISE EXCEPTION 'Invalid slot' USING ERRCODE='22023'; END IF;
 IF jsonb_typeof(p->'capacity')<>'null' THEN
  v_capacity:=app_private.tiffin_jint(p->'capacity',1,2147483647);
  IF v_capacity IS NULL THEN RAISE EXCEPTION 'Invalid slot' USING ERRCODE='22023'; END IF;
 END IF;
 IF p ? 'enabled' THEN
  IF jsonb_typeof(p->'enabled')<>'boolean' THEN RAISE EXCEPTION 'Invalid slot' USING ERRCODE='22023'; END IF;
  v_enabled:=(p->'enabled')::boolean;
 END IF;

 SELECT * INTO s FROM tiffin_slots WHERE organization_id=v_org AND outlet_id=p_outlet AND kind=v_kind FOR UPDATE;
 IF FOUND THEN
  v_before:=jsonb_build_object('id',s.id,'kind',s.kind,'startMinute',s.start_minute,'endMinute',s.end_minute,
   'cutoffMinutesBefore',s.cutoff_minutes_before,'capacity',s.capacity,'enabled',s.enabled);
  UPDATE tiffin_slots SET start_minute=v_start,end_minute=v_end,cutoff_minutes_before=v_cutoff,
   capacity=v_capacity,enabled=COALESCE(v_enabled,enabled),updated_at=clock_timestamp()
  WHERE organization_id=v_org AND outlet_id=p_outlet AND id=s.id RETURNING * INTO s;
 ELSE
  INSERT INTO tiffin_slots(organization_id,outlet_id,kind,start_minute,end_minute,cutoff_minutes_before,capacity,enabled)
  VALUES(v_org,p_outlet,v_kind,v_start,v_end,v_cutoff,v_capacity,COALESCE(v_enabled,true)) RETURNING * INTO s;
 END IF;
 v_after:=jsonb_build_object('id',s.id,'kind',s.kind,'startMinute',s.start_minute,'endMinute',s.end_minute,
  'cutoffMinutesBefore',s.cutoff_minutes_before,'capacity',s.capacity,'enabled',s.enabled);
 PERFORM app_private.tiffin_audit(p_outlet,'tiffin.slot.save','tiffin_slot',s.id,v_before,v_after);
 RETURN v_after;
END $$;

-- ── Combos ─────────────────────────────────────────────────────────────────────────────────────────
-- Full save: {id?, name, description?, priceMinor, items[1..20], addons[0..20], archived?}. A client
-- 'currency' key is ignored; the outlet currency is stored. Archive toggle: {id, archived}.
CREATE FUNCTION app_private.tiffin_combo_save(p_outlet text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_currency text; v_id text; v_name text; v_desc text; v_price bigint;
 v_archived boolean; v_toggle boolean; v_exists boolean:=false; c tiffin_combos%ROWTYPE;
 v_was_live boolean:=false; v_live boolean; v_before jsonb; v_after jsonb; v_action text;
 v_now timestamptz:=clock_timestamp();
BEGIN
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tiffin:'||p_outlet,0));
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 -- Lock order matches manage_organization (organizations, then restaurants): the FK checks of the
 -- inserts below take FOR KEY SHARE on the organization, so take it before any restaurants lock,
 -- otherwise an org FOR UPDATE + UPDATE restaurants in another transaction deadlocks with this save.
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;
 PERFORM 1 FROM organizations WHERE id=v_org FOR KEY SHARE;
 -- FOR SHARE blocks a concurrent currency change until this save commits (see the currency guard),
 -- and a save that waited here re-reads the committed currency.
 SELECT currency INTO v_currency FROM restaurants WHERE id=p_outlet AND organization_id=v_org FOR SHARE;

 IF NOT app_private.tiffin_keys_ok(p,ARRAY['id','name','description','priceMinor','items','addons','archived','currency'])
  THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
 v_toggle:=(p ? 'archived') AND app_private.tiffin_keys_ok(p,ARRAY['id','archived']);
 IF p ? 'id' THEN
  v_id:=app_private.tiffin_jid(p->'id');
  IF v_id IS NULL THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
 END IF;
 IF p ? 'archived' THEN
  IF jsonb_typeof(p->'archived')<>'boolean' THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
  v_archived:=(p->'archived')::boolean;
 END IF;
 IF v_toggle THEN
  IF v_id IS NULL THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
 ELSE
  v_name:=app_private.tiffin_jlabel(p->'name',80);
  v_price:=app_private.tiffin_jint(p->'priceMinor',0,2147483647);
  IF v_name IS NULL OR v_price IS NULL THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
  IF p ? 'description' THEN
   IF jsonb_typeof(p->'description')<>'string' OR length(p->>'description')>300
    THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
   v_desc:=p->>'description';
  ELSE v_desc:=''; END IF;
  IF jsonb_typeof(p->'items') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'addons') IS DISTINCT FROM 'array'
   THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
  IF jsonb_array_length(p->'items') NOT BETWEEN 1 AND 20 OR jsonb_array_length(p->'addons')>20
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'items') x
     WHERE NOT app_private.tiffin_keys_ok(x,ARRAY['label','quantity'])
        OR app_private.tiffin_jlabel(x->'label',80) IS NULL OR app_private.tiffin_jint(x->'quantity',1,99) IS NULL)
   OR EXISTS(SELECT 1 FROM jsonb_array_elements(p->'addons') x
     WHERE NOT app_private.tiffin_keys_ok(x,ARRAY['label','priceMinor'])
        OR app_private.tiffin_jlabel(x->'label',80) IS NULL
        OR app_private.tiffin_jint(x->'priceMinor',0,2147483647) IS NULL)
   THEN RAISE EXCEPTION 'Invalid combo' USING ERRCODE='22023'; END IF;
 END IF;

 IF v_id IS NOT NULL THEN
  SELECT * INTO c FROM tiffin_combos WHERE organization_id=v_org AND outlet_id=p_outlet AND id=v_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Combo not allowed' USING ERRCODE='22023'; END IF;
  v_exists:=true;
  v_was_live:=NOT c.archived;
  v_before:=app_private.tiffin_combo_json(v_org,p_outlet,v_id);
 END IF;
 v_live:=NOT COALESCE(v_archived,CASE WHEN v_exists THEN c.archived ELSE false END);
 -- A restore keeps the stored price, so it must already be in the outlet currency.
 IF v_toggle AND v_live AND NOT v_was_live AND c.currency<>v_currency
  THEN RAISE EXCEPTION 'Explicit repricing required' USING ERRCODE='22023'; END IF;
 IF v_live AND NOT v_was_live AND (SELECT count(*) FROM tiffin_combos
   WHERE organization_id=v_org AND outlet_id=p_outlet AND NOT archived)>=200
  THEN RAISE EXCEPTION 'Combo limit reached' USING ERRCODE='54000'; END IF;

 IF v_toggle THEN
  UPDATE tiffin_combos SET archived=v_archived,updated_at=v_now
  WHERE organization_id=v_org AND outlet_id=p_outlet AND id=v_id;
  v_action:=CASE WHEN v_archived THEN 'tiffin.combo.archive' ELSE 'tiffin.combo.restore' END;
 ELSE
  IF v_exists THEN
   UPDATE tiffin_combos SET name=v_name,description=v_desc,price_minor=v_price,currency=v_currency,
    archived=NOT v_live,updated_at=v_now
   WHERE organization_id=v_org AND outlet_id=p_outlet AND id=v_id;
   DELETE FROM tiffin_combo_items WHERE organization_id=v_org AND outlet_id=p_outlet AND combo_id=v_id;
   DELETE FROM tiffin_combo_addons WHERE organization_id=v_org AND outlet_id=p_outlet AND combo_id=v_id;
   v_action:='tiffin.combo.update';
  ELSE
   INSERT INTO tiffin_combos(organization_id,outlet_id,name,description,price_minor,currency,archived)
   VALUES(v_org,p_outlet,v_name,v_desc,v_price,v_currency,NOT v_live) RETURNING id INTO v_id;
   v_action:='tiffin.combo.create';
  END IF;
  -- created_at carries the submitted order (one microsecond apart) for stable reads.
  INSERT INTO tiffin_combo_items(organization_id,outlet_id,combo_id,label,quantity,created_at,updated_at)
  SELECT v_org,p_outlet,v_id,app_private.tiffin_jlabel(x->'label',80),app_private.tiffin_jint(x->'quantity',1,99),
   v_now+o*interval '1 microsecond',v_now
  FROM jsonb_array_elements(p->'items') WITH ORDINALITY t(x,o);
  INSERT INTO tiffin_combo_addons(organization_id,outlet_id,combo_id,label,price_minor,created_at,updated_at)
  SELECT v_org,p_outlet,v_id,app_private.tiffin_jlabel(x->'label',80),
   app_private.tiffin_jint(x->'priceMinor',0,2147483647),v_now+o*interval '1 microsecond',v_now
  FROM jsonb_array_elements(p->'addons') WITH ORDINALITY t(x,o);
 END IF;
 v_after:=app_private.tiffin_combo_json(v_org,p_outlet,v_id);
 PERFORM app_private.tiffin_audit(p_outlet,v_action,'tiffin_combo',v_id,v_before,v_after);
 RETURN v_after;
END $$;

-- ── Weekly menu ────────────────────────────────────────────────────────────────────────────────────
-- {slotKind, weekday (EXTRACT(DOW) 0..6), comboIds (ordered, unique, live, same outlet)}. An empty
-- list removes the weekday entry.
CREATE FUNCTION app_private.tiffin_week_set(p_outlet text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_kind text; v_day integer; v_ids text[]; v_slot text; v_menu text; v_before jsonb;
 v_after jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tiffin:'||p_outlet,0));
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 SELECT organization_id INTO v_org FROM restaurants WHERE id=p_outlet;

 IF NOT app_private.tiffin_keys_ok(p,ARRAY['slotKind','weekday','comboIds'])
  THEN RAISE EXCEPTION 'Invalid week menu' USING ERRCODE='22023'; END IF;
 v_kind:=CASE WHEN jsonb_typeof(p->'slotKind')='string' AND p->>'slotKind' IN ('lunch','dinner') THEN p->>'slotKind' END;
 v_day:=app_private.tiffin_jint(p->'weekday',0,6);
 v_ids:=app_private.tiffin_jids(p->'comboIds');
 IF v_kind IS NULL OR v_day IS NULL OR v_ids IS NULL
  THEN RAISE EXCEPTION 'Invalid week menu' USING ERRCODE='22023'; END IF;

 SELECT id INTO v_slot FROM tiffin_slots WHERE organization_id=v_org AND outlet_id=p_outlet AND kind=v_kind;
 IF NOT FOUND THEN RAISE EXCEPTION 'Slot not configured' USING ERRCODE='22023'; END IF;
 IF (SELECT count(*) FROM tiffin_combos WHERE organization_id=v_org AND outlet_id=p_outlet
     AND id=ANY(v_ids) AND NOT archived)<>cardinality(v_ids)
  THEN RAISE EXCEPTION 'Combo not allowed' USING ERRCODE='22023'; END IF;

 SELECT id INTO v_menu FROM tiffin_week_menus
 WHERE organization_id=v_org AND outlet_id=p_outlet AND slot_id=v_slot AND weekday=v_day FOR UPDATE;
 v_before:=jsonb_build_object('slotKind',v_kind,'weekday',v_day,'comboIds',
  COALESCE((SELECT jsonb_agg(w.combo_id ORDER BY w.sort_order,w.combo_id) FROM tiffin_week_menu_combos w
   WHERE w.organization_id=v_org AND w.outlet_id=p_outlet AND w.week_menu_id=v_menu),'[]'::jsonb));
 IF cardinality(v_ids)=0 THEN
  DELETE FROM tiffin_week_menus WHERE organization_id=v_org AND outlet_id=p_outlet AND id=v_menu;
 ELSE
  IF v_menu IS NULL THEN
   INSERT INTO tiffin_week_menus(organization_id,outlet_id,slot_id,weekday)
   VALUES(v_org,p_outlet,v_slot,v_day) RETURNING id INTO v_menu;
  ELSE
   UPDATE tiffin_week_menus SET updated_at=v_now WHERE organization_id=v_org AND outlet_id=p_outlet AND id=v_menu;
   DELETE FROM tiffin_week_menu_combos WHERE organization_id=v_org AND outlet_id=p_outlet AND week_menu_id=v_menu;
  END IF;
  INSERT INTO tiffin_week_menu_combos(organization_id,outlet_id,week_menu_id,combo_id,sort_order)
  SELECT v_org,p_outlet,v_menu,u,(o-1)::integer FROM unnest(v_ids) WITH ORDINALITY t(u,o);
 END IF;
 v_after:=jsonb_build_object('slotKind',v_kind,'weekday',v_day,'comboIds',to_jsonb(v_ids));
 PERFORM app_private.tiffin_audit(p_outlet,'tiffin.week.set','tiffin_week_menu',v_slot||':'||v_day,v_before,v_after);
 RETURN v_after;
END $$;

-- ── Date overrides ─────────────────────────────────────────────────────────────────────────────────
-- Set: {slotKind, localDate, closed, comboIds}; localDate within outlet-local today..today+366; a
-- closed day lists no combos. Clear: {slotKind, localDate, clear: true} (any date).
CREATE FUNCTION app_private.tiffin_override_set(p_outlet text,p jsonb) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_tz text; v_today date; v_kind text; v_date date; v_closed boolean; v_ids text[];
 v_clear boolean:=false; v_slot text; o tiffin_date_overrides%ROWTYPE; v_found boolean; v_before jsonb;
 v_after jsonb; v_now timestamptz:=clock_timestamp();
BEGIN
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('tiffin:'||p_outlet,0));
 IF NOT app_private.tiffin_can(p_outlet,'write') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 SELECT organization_id,timezone INTO v_org,v_tz FROM restaurants WHERE id=p_outlet;
 v_today:=(statement_timestamp() AT TIME ZONE v_tz)::date;

 IF NOT app_private.tiffin_keys_ok(p,ARRAY['slotKind','localDate','closed','comboIds','clear'])
  THEN RAISE EXCEPTION 'Invalid override' USING ERRCODE='22023'; END IF;
 v_kind:=CASE WHEN jsonb_typeof(p->'slotKind')='string' AND p->>'slotKind' IN ('lunch','dinner') THEN p->>'slotKind' END;
 v_date:=app_private.tiffin_jdate(p->'localDate');
 IF v_kind IS NULL OR v_date IS NULL THEN RAISE EXCEPTION 'Invalid override' USING ERRCODE='22023'; END IF;
 IF p ? 'clear' THEN
  IF jsonb_typeof(p->'clear')<>'boolean' THEN RAISE EXCEPTION 'Invalid override' USING ERRCODE='22023'; END IF;
  v_clear:=(p->'clear')::boolean;
 END IF;
 IF v_clear THEN
  IF NOT app_private.tiffin_keys_ok(p,ARRAY['slotKind','localDate','clear'])
   THEN RAISE EXCEPTION 'Invalid override' USING ERRCODE='22023'; END IF;
 ELSE
  IF jsonb_typeof(p->'closed') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'Invalid override' USING ERRCODE='22023'; END IF;
  v_closed:=(p->'closed')::boolean;
  v_ids:=app_private.tiffin_jids(p->'comboIds');
  IF v_ids IS NULL OR (v_closed AND cardinality(v_ids)>0) OR v_date<v_today OR v_date>v_today+366
   THEN RAISE EXCEPTION 'Invalid override' USING ERRCODE='22023'; END IF;
 END IF;

 SELECT id INTO v_slot FROM tiffin_slots WHERE organization_id=v_org AND outlet_id=p_outlet AND kind=v_kind;
 IF NOT FOUND THEN RAISE EXCEPTION 'Slot not configured' USING ERRCODE='22023'; END IF;
 IF NOT v_clear AND (SELECT count(*) FROM tiffin_combos WHERE organization_id=v_org AND outlet_id=p_outlet
     AND id=ANY(v_ids) AND NOT archived)<>cardinality(v_ids)
  THEN RAISE EXCEPTION 'Combo not allowed' USING ERRCODE='22023'; END IF;

 SELECT * INTO o FROM tiffin_date_overrides
 WHERE organization_id=v_org AND outlet_id=p_outlet AND slot_id=v_slot AND local_date=v_date FOR UPDATE;
 v_found:=FOUND;
 IF v_found THEN
  v_before:=jsonb_build_object('slotKind',v_kind,'localDate',v_date::text,'closed',o.closed,'comboIds',
   COALESCE((SELECT jsonb_agg(x.combo_id ORDER BY x.sort_order,x.combo_id) FROM tiffin_date_override_combos x
    WHERE x.organization_id=v_org AND x.outlet_id=p_outlet AND x.override_id=o.id),'[]'::jsonb));
 END IF;
 IF v_clear THEN
  IF v_found THEN
   DELETE FROM tiffin_date_overrides WHERE organization_id=v_org AND outlet_id=p_outlet AND id=o.id;
  END IF;
  v_after:=jsonb_build_object('slotKind',v_kind,'localDate',v_date::text,'cleared',true);
  PERFORM app_private.tiffin_audit(p_outlet,'tiffin.override.clear','tiffin_date_override',
   v_slot||':'||v_date::text,v_before,NULL);
  RETURN v_after;
 END IF;
 IF v_found THEN
  UPDATE tiffin_date_overrides SET closed=v_closed,updated_at=v_now
  WHERE organization_id=v_org AND outlet_id=p_outlet AND id=o.id;
  DELETE FROM tiffin_date_override_combos WHERE organization_id=v_org AND outlet_id=p_outlet AND override_id=o.id;
 ELSE
  INSERT INTO tiffin_date_overrides(organization_id,outlet_id,slot_id,local_date,closed)
  VALUES(v_org,p_outlet,v_slot,v_date,v_closed) RETURNING * INTO o;
 END IF;
 INSERT INTO tiffin_date_override_combos(organization_id,outlet_id,override_id,combo_id,sort_order)
 SELECT v_org,p_outlet,o.id,u,(n-1)::integer FROM unnest(v_ids) WITH ORDINALITY t(u,n);
 v_after:=jsonb_build_object('slotKind',v_kind,'localDate',v_date::text,'closed',v_closed,'comboIds',to_jsonb(v_ids));
 PERFORM app_private.tiffin_audit(p_outlet,'tiffin.override.set','tiffin_date_override',
  v_slot||':'||v_date::text,v_before,v_after);
 RETURN v_after;
END $$;

-- ── Read ───────────────────────────────────────────────────────────────────────────────────────────
-- Archived combos are listed separately and are hidden from week and override combo lists. Their stored
-- links survive only until that week cell or override is saved again (tiffin_week_set and
-- tiffin_override_set replace the whole list), so a restore brings a combo back only where its link was
-- never re-saved. Overrides from outlet-local yesterday forward.
CREATE FUNCTION app_private.tiffin_menu_read(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_org text; v_currency text; v_tz text; v_today date;
BEGIN
 IF NOT app_private.tiffin_can(p_outlet,'read') THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
 SELECT organization_id,currency,timezone INTO v_org,v_currency,v_tz FROM restaurants WHERE id=p_outlet;
 v_today:=(statement_timestamp() AT TIME ZONE v_tz)::date;
 RETURN jsonb_build_object(
  'outlet',jsonb_build_object('id',p_outlet,'currency',v_currency,'timezone',v_tz,'today',v_today::text),
  'slots',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',s.id,'kind',s.kind,'startMinute',s.start_minute,
     'endMinute',s.end_minute,'cutoffMinutesBefore',s.cutoff_minutes_before,'capacity',s.capacity,'enabled',s.enabled)
     ORDER BY s.kind='dinner',s.id)
    FROM tiffin_slots s WHERE s.organization_id=v_org AND s.outlet_id=p_outlet),'[]'::jsonb),
  'combos',COALESCE((SELECT jsonb_agg(app_private.tiffin_combo_json(v_org,p_outlet,c.id) ORDER BY c.created_at,c.id)
    FROM tiffin_combos c WHERE c.organization_id=v_org AND c.outlet_id=p_outlet AND NOT c.archived),'[]'::jsonb),
  'archivedCombos',COALESCE((SELECT jsonb_agg(app_private.tiffin_combo_json(v_org,p_outlet,c.id) ORDER BY c.created_at,c.id)
    FROM tiffin_combos c WHERE c.organization_id=v_org AND c.outlet_id=p_outlet AND c.archived),'[]'::jsonb),
  'week',COALESCE((SELECT jsonb_agg(jsonb_build_object('slotKind',e.kind,'weekday',e.weekday,'comboIds',e.ids)
     ORDER BY e.weekday,e.kind='dinner')
    FROM (SELECT s.kind,m.weekday,jsonb_agg(w.combo_id ORDER BY w.sort_order,w.combo_id) AS ids
      FROM tiffin_week_menus m
      JOIN tiffin_slots s ON s.organization_id=m.organization_id AND s.outlet_id=m.outlet_id AND s.id=m.slot_id
      JOIN tiffin_week_menu_combos w ON w.organization_id=m.organization_id AND w.outlet_id=m.outlet_id AND w.week_menu_id=m.id
      JOIN tiffin_combos c ON c.organization_id=w.organization_id AND c.outlet_id=w.outlet_id AND c.id=w.combo_id AND NOT c.archived
      WHERE m.organization_id=v_org AND m.outlet_id=p_outlet
      GROUP BY s.kind,m.weekday) e),'[]'::jsonb),
  'overrides',COALESCE((SELECT jsonb_agg(jsonb_build_object('slotKind',s.kind,'localDate',d.local_date::text,
     'closed',d.closed,'comboIds',COALESCE((SELECT jsonb_agg(x.combo_id ORDER BY x.sort_order,x.combo_id)
       FROM tiffin_date_override_combos x
       JOIN tiffin_combos c ON c.organization_id=x.organization_id AND c.outlet_id=x.outlet_id AND c.id=x.combo_id AND NOT c.archived
       WHERE x.organization_id=d.organization_id AND x.outlet_id=d.outlet_id AND x.override_id=d.id),'[]'::jsonb))
     ORDER BY d.local_date,s.kind='dinner')
    FROM tiffin_date_overrides d
    JOIN tiffin_slots s ON s.organization_id=d.organization_id AND s.outlet_id=d.outlet_id AND s.id=d.slot_id
    WHERE d.organization_id=v_org AND d.outlet_id=p_outlet AND d.local_date>=v_today-1),'[]'::jsonb));
END $$;

-- ── Currency guard ─────────────────────────────────────────────────────────────────────────────────
-- Archived combos keep their historical currency and never block.
CREATE FUNCTION app_private.guard_tiffin_currency() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NEW.currency IS DISTINCT FROM OLD.currency AND EXISTS(SELECT 1 FROM tiffin_combos c
   WHERE c.organization_id=NEW.organization_id AND c.outlet_id=NEW.id AND NOT c.archived AND c.currency<>NEW.currency)
  THEN RAISE EXCEPTION 'Explicit repricing required' USING ERRCODE='22023'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tiffin_currency_guard BEFORE UPDATE OF currency ON restaurants
 FOR EACH ROW EXECUTE FUNCTION app_private.guard_tiffin_currency();

REVOKE ALL ON FUNCTION app_private.tiffin_keys_ok(jsonb,text[]),app_private.tiffin_jint(jsonb,bigint,bigint),
 app_private.tiffin_jlabel(jsonb,integer),app_private.tiffin_jid(jsonb),app_private.tiffin_jids(jsonb),
 app_private.tiffin_jdate(jsonb),app_private.tiffin_combo_json(text,text,text),
 app_private.tiffin_audit(text,text,text,text,jsonb,jsonb),app_private.guard_tiffin_currency(),
 app_private.tiffin_can(text,text),app_private.tiffin_slot_save(text,jsonb),app_private.tiffin_combo_save(text,jsonb),
 app_private.tiffin_week_set(text,jsonb),app_private.tiffin_override_set(text,jsonb),app_private.tiffin_menu_read(text)
 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.tiffin_can(text,text),app_private.tiffin_slot_save(text,jsonb),
 app_private.tiffin_combo_save(text,jsonb),app_private.tiffin_week_set(text,jsonb),
 app_private.tiffin_override_set(text,jsonb),app_private.tiffin_menu_read(text) TO menuminute_app;
