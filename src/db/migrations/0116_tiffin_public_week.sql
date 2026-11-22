-- 0116: Tiffin & Home-Chef Hub phase 2 public reads (ADR 032). Adds two token-addressed, read-only
-- SECURITY DEFINER entry points for the public weekly menu and the server quote, plus owner-only helpers.
-- 0116 creates new functions only; it changes no table, constraint, grant, RLS setting or earlier function.
-- Token resolution is exactly app_private.free_menu_public's (qr_codes.destination_token, q.is_active,
-- outlet is_active AND is_published, organization is_active) plus outlet_type='tiffin'. Every failure
-- (unknown or revoked token, unpublished or inactive outlet, inactive organization, non-tiffin outlet,
-- malformed argument) returns NULL, never an error, so existence is not distinguishable.
-- Dates are outlet-local calendar dates (restaurants.timezone); weekday is EXTRACT(DOW): 0=Sunday.
-- A date override replaces that day's menu for its slot: closed=true offers nothing, closed=false offers
-- exactly its combos (possibly none); no override means the weekday menu. Archived combos and disabled
-- slots are never offered. Every lookup is scoped by organization_id AND outlet_id. No locks, no
-- dynamic SQL, no writes. Output never contains organization ids.
-- tiffin_public_week(token, from, days): NULL unless days is 1..14 and every date is within outlet-local
-- today-1 .. today+366 (from defaults to today). tiffin_public_offer(token, date, slot): NULL only when
-- the token does not resolve or an argument is malformed; for a resolved token it returns the outlet
-- currency and the combos offered for that date and slot, with an empty list when the slot is disabled,
-- closed, has no menu or the date is outside the window. Prices are emitted as decimal strings.
-- The *_at variants take the clock as an argument (tests); they are executable by the owner only.
-- Grants: tiffin_public_week(text,date,integer) and tiffin_public_offer(text,date,text) are executable
-- by menuminute_app only (not PUBLIC, not menuminute_worker); the helpers by nobody but the owner.
-- Rollback: DROP FUNCTION app_private.tiffin_public_week(text,date,integer),
-- app_private.tiffin_public_offer(text,date,text), then the owner-only helpers
-- app_private.tiffin_public_week_at(text,date,integer,timestamptz),
-- app_private.tiffin_public_offer_at(text,date,text,timestamptz),
-- app_private.tiffin_public_slot_day(text,text,text,date) and app_private.tiffin_public_combo(text,text,text).
-- No data is written by 0116, so nothing else needs to be restored.

-- ── Owner-only helpers (invoker rights; reached only through the definer entry points) ─────────────
CREATE FUNCTION app_private.tiffin_public_combo(p_org text,p_outlet text,p_combo text) RETURNS jsonb
LANGUAGE sql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'priceMinor',c.price_minor::text,
  'items',COALESCE((SELECT jsonb_agg(jsonb_build_object('label',i.label,'quantity',i.quantity) ORDER BY i.created_at,i.id)
    FROM tiffin_combo_items i
    WHERE i.organization_id=c.organization_id AND i.outlet_id=c.outlet_id AND i.combo_id=c.id),'[]'::jsonb),
  'addons',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'label',a.label,'priceMinor',a.price_minor::text)
    ORDER BY a.created_at,a.id) FROM tiffin_combo_addons a
    WHERE a.organization_id=c.organization_id AND a.outlet_id=c.outlet_id AND a.combo_id=c.id),'[]'::jsonb))
 FROM tiffin_combos c WHERE c.organization_id=p_org AND c.outlet_id=p_outlet AND c.id=p_combo AND NOT c.archived
$$;

-- {closed, combos} for one slot and local date, applying the override-replaces-day rule.
CREATE FUNCTION app_private.tiffin_public_slot_day(p_org text,p_outlet text,p_slot text,p_date date) RETURNS jsonb
LANGUAGE plpgsql STABLE SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE o tiffin_date_overrides%ROWTYPE; v jsonb;
BEGIN
 SELECT * INTO o FROM tiffin_date_overrides
 WHERE organization_id=p_org AND outlet_id=p_outlet AND slot_id=p_slot AND local_date=p_date;
 IF FOUND THEN
  IF o.closed THEN RETURN jsonb_build_object('closed',true,'combos','[]'::jsonb); END IF;
  SELECT jsonb_agg(app_private.tiffin_public_combo(p_org,p_outlet,c.id) ORDER BY x.sort_order,x.combo_id) INTO v
  FROM tiffin_date_override_combos x
  JOIN tiffin_combos c ON c.organization_id=x.organization_id AND c.outlet_id=x.outlet_id AND c.id=x.combo_id AND NOT c.archived
  WHERE x.organization_id=p_org AND x.outlet_id=p_outlet AND x.override_id=o.id;
 ELSE
  SELECT jsonb_agg(app_private.tiffin_public_combo(p_org,p_outlet,c.id) ORDER BY w.sort_order,w.combo_id) INTO v
  FROM tiffin_week_menus m
  JOIN tiffin_week_menu_combos w ON w.organization_id=m.organization_id AND w.outlet_id=m.outlet_id AND w.week_menu_id=m.id
  JOIN tiffin_combos c ON c.organization_id=w.organization_id AND c.outlet_id=w.outlet_id AND c.id=w.combo_id AND NOT c.archived
  WHERE m.organization_id=p_org AND m.outlet_id=p_outlet AND m.slot_id=p_slot
   AND m.weekday=EXTRACT(DOW FROM p_date)::integer;
 END IF;
 RETURN jsonb_build_object('closed',false,'combos',COALESCE(v,'[]'::jsonb));
END $$;

-- ── Public week ────────────────────────────────────────────────────────────────────────────────────
CREATE FUNCTION app_private.tiffin_public_week_at(p_token text,p_from date,p_days integer,p_now timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r record; s record; v_today date; v_from date; d date; v_day jsonb; v_slots jsonb; v_days jsonb:='[]'::jsonb;
BEGIN
 IF p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 128 OR p_days IS NULL OR p_days NOT BETWEEN 1 AND 14
  OR p_now IS NULL THEN RETURN NULL; END IF;
 SELECT rs.id,rs.organization_id,rs.name,rs.currency,rs.timezone INTO r
 FROM qr_codes q JOIN restaurants rs ON rs.id=q.restaurant_id JOIN organizations org ON org.id=rs.organization_id
 WHERE q.destination_token=p_token AND q.is_active AND rs.is_active AND rs.is_published AND org.is_active
  AND rs.outlet_type='tiffin' LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 v_today:=(p_now AT TIME ZONE r.timezone)::date;
 v_from:=COALESCE(p_from,v_today);
 IF v_from<v_today-1 OR v_from+(p_days-1)>v_today+366 THEN RETURN NULL; END IF;
 FOR i IN 0..p_days-1 LOOP
  d:=v_from+i;
  v_slots:='{}'::jsonb;
  FOR s IN SELECT t.id,t.kind,t.start_minute,t.end_minute FROM tiffin_slots t
   WHERE t.organization_id=r.organization_id AND t.outlet_id=r.id AND t.enabled ORDER BY t.kind='dinner',t.id LOOP
   v_day:=app_private.tiffin_public_slot_day(r.organization_id,r.id,s.id,d);
   v_slots:=v_slots||jsonb_build_object(s.kind,jsonb_build_object('kind',s.kind,'startMinute',s.start_minute,
    'endMinute',s.end_minute,'closed',v_day->'closed',
    'open',NOT (v_day->>'closed')::boolean AND jsonb_array_length(v_day->'combos')>0,'combos',v_day->'combos'));
  END LOOP;
  v_days:=v_days||jsonb_build_array(jsonb_build_object('localDate',d::text,'weekday',EXTRACT(DOW FROM d)::integer,
   'slots',v_slots));
 END LOOP;
 RETURN jsonb_build_object('outlet',jsonb_build_object('id',r.id,'name',r.name,'currency',r.currency,
  'timezone',r.timezone),'today',v_today::text,'days',v_days);
END $$;

CREATE FUNCTION app_private.tiffin_public_week(p_token text,p_from date,p_days integer) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_private.tiffin_public_week_at(p_token,p_from,p_days,statement_timestamp())
$$;

-- ── Offer for one date and slot (server quote input) ───────────────────────────────────────────────
CREATE FUNCTION app_private.tiffin_public_offer_at(p_token text,p_date date,p_slot text,p_now timestamptz)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE r record; v_today date; v_slot text; v_combos jsonb:='[]'::jsonb;
BEGIN
 IF p_token IS NULL OR length(p_token) NOT BETWEEN 1 AND 128 OR p_date IS NULL OR p_slot IS NULL
  OR p_slot NOT IN ('lunch','dinner') OR p_now IS NULL THEN RETURN NULL; END IF;
 SELECT rs.id,rs.organization_id,rs.currency,rs.timezone INTO r
 FROM qr_codes q JOIN restaurants rs ON rs.id=q.restaurant_id JOIN organizations org ON org.id=rs.organization_id
 WHERE q.destination_token=p_token AND q.is_active AND rs.is_active AND rs.is_published AND org.is_active
  AND rs.outlet_type='tiffin' LIMIT 1;
 IF NOT FOUND THEN RETURN NULL; END IF;
 v_today:=(p_now AT TIME ZONE r.timezone)::date;
 IF p_date BETWEEN v_today-1 AND v_today+366 THEN
  SELECT t.id INTO v_slot FROM tiffin_slots t
  WHERE t.organization_id=r.organization_id AND t.outlet_id=r.id AND t.kind=p_slot AND t.enabled;
  IF v_slot IS NOT NULL THEN
   v_combos:=app_private.tiffin_public_slot_day(r.organization_id,r.id,v_slot,p_date)->'combos';
  END IF;
 END IF;
 RETURN jsonb_build_object('outletId',r.id,'currency',r.currency,'localDate',p_date::text,'slotKind',p_slot,
  'combos',v_combos);
END $$;

CREATE FUNCTION app_private.tiffin_public_offer(p_token text,p_date date,p_slot text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT app_private.tiffin_public_offer_at(p_token,p_date,p_slot,statement_timestamp())
$$;

REVOKE ALL ON FUNCTION app_private.tiffin_public_combo(text,text,text),
 app_private.tiffin_public_slot_day(text,text,text,date),
 app_private.tiffin_public_week_at(text,date,integer,timestamptz),
 app_private.tiffin_public_offer_at(text,date,text,timestamptz),
 app_private.tiffin_public_week(text,date,integer),app_private.tiffin_public_offer(text,date,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.tiffin_public_week(text,date,integer),
 app_private.tiffin_public_offer(text,date,text) TO menuminute_app;
