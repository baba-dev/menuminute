-- 0079: Plan overflow after a downgrade (docs/plans-and-limits.md, slice 3).
-- When an outlet has more live dishes than its plan allows, it first gets a grace period, then the
-- dishes beyond the cap (in menu order) are HIDDEN from guests. Nothing is ever deleted: the owner's
-- menu, drafts and releases are untouched and the dishes return the moment the plan allows them.
-- QR codes, tables and chairs are never switched off (printed QR links must keep working).
--
-- Everything is inert until the owner-only switch is turned on (default OFF), and the filter also
-- ignores hidden rows as soon as the outlet's current plan is higher than the plan it was hidden
-- under, so an upgrade restores dishes instantly without waiting for the worker.
-- Forward-only. To disable: UPDATE app_private.plan_settings SET overflow_hiding_enabled=false.

ALTER TABLE app_private.plan_settings
  ADD COLUMN overflow_hiding_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN overflow_grace_days integer NOT NULL DEFAULT 14
    CHECK (overflow_grace_days BETWEEN 0 AND 365);

CREATE TABLE app_private.plan_overflow (
  outlet_id text PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  plan_rank integer NOT NULL,
  cap integer NOT NULL,
  published_count integer NOT NULL,
  first_over_at timestamptz NOT NULL,
  grace_until timestamptz NOT NULL,
  hidden_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_private.plan_hidden_dishes (
  outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  dish_id text NOT NULL,
  plan_rank integer NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (outlet_id, dish_id)
);
REVOKE ALL ON app_private.plan_overflow, app_private.plan_hidden_dishes
  FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- 0 = Free, 1 = Ordering, 2 = Kitchen Pro, 99 = self-hosted Community (never capped).
CREATE FUNCTION app_private.plan_rank(p_org text) RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT CASE
    WHEN app_private.is_community_edition() THEN 99
    WHEN EXISTS(SELECT 1 FROM entitlement_grants g
      WHERE g.organization_id=p_org AND g.capability='kitchen.new' AND g.revoked_at IS NULL
        AND g.starts_at<=statement_timestamp() AND g.ends_at>statement_timestamp()) THEN 2
    WHEN app_private.paid_ordering_active(p_org) THEN 1
    ELSE 0 END
$$;
REVOKE ALL ON FUNCTION app_private.plan_rank(text) FROM PUBLIC;

-- Live dishes in menu order: published, non-archived, de-duplicated across the outlet's menus.
-- Order is menu id, then category position, then dish position, so owners control it by reordering.
CREATE FUNCTION app_private.plan_published_dishes(p_outlet text) RETURNS TABLE(dish_id text, ord bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  WITH items AS (
    SELECT t.i->>'id' AS dish_id, m.id AS menu_id, c.c_ord, t.i_ord
    FROM menu_assignments a
    JOIN menus m ON m.id=a.menu_id AND NOT m.archived
    JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(rel.document->'categories')='array' THEN rel.document->'categories' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS c(cat,c_ord)
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(c.cat->'items')='array' THEN c.cat->'items' ELSE '[]'::jsonb END
    ) WITH ORDINALITY AS t(i,i_ord)
    WHERE a.outlet_id=p_outlet AND t.i ? 'id'
      AND COALESCE(t.i->>'archived','false')<>'true'
      AND COALESCE(c.cat->>'archived','false')<>'true'
  ), firsts AS (
    SELECT DISTINCT ON (dish_id) dish_id, menu_id, c_ord, i_ord FROM items
    ORDER BY dish_id, menu_id, c_ord, i_ord
  )
  SELECT f.dish_id, row_number() OVER (ORDER BY f.menu_id, f.c_ord, f.i_ord) FROM firsts f
$$;
REVOKE ALL ON FUNCTION app_private.plan_published_dishes(text) FROM PUBLIC;

-- Removes hidden dishes from a published document. Returns the document unchanged unless the switch
-- is on, the outlet has hidden rows and its current plan has not risen above the plan it was hidden
-- under. Categories emptied by hiding are omitted; originally empty categories are kept.
CREATE FUNCTION app_private.plan_filter_document(p_outlet text, p_doc jsonb) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v_rank integer; v_hidden text[]; v_cats jsonb;
BEGIN
  IF NOT COALESCE((SELECT overflow_hiding_enabled FROM app_private.plan_settings WHERE singleton),false) THEN
    RETURN p_doc;
  END IF;
  IF jsonb_typeof(p_doc->'categories') IS DISTINCT FROM 'array' THEN RETURN p_doc; END IF;
  IF NOT EXISTS(SELECT 1 FROM app_private.plan_hidden_dishes WHERE outlet_id=p_outlet) THEN RETURN p_doc; END IF;
  SELECT app_private.plan_rank(r.organization_id) INTO v_rank FROM restaurants r WHERE r.id=p_outlet;
  SELECT array_agg(h.dish_id) INTO v_hidden FROM app_private.plan_hidden_dishes h
   WHERE h.outlet_id=p_outlet AND h.plan_rank>=COALESCE(v_rank,0);
  IF v_hidden IS NULL THEN RETURN p_doc; END IF;
  SELECT COALESCE(jsonb_agg(x.cat ORDER BY x.ord),'[]'::jsonb) INTO v_cats
  FROM (
    SELECT c.ord,
      CASE WHEN jsonb_typeof(c.cat->'items')='array' THEN jsonb_set(c.cat,'{items}',f.kept) ELSE c.cat END AS cat
    FROM jsonb_array_elements(p_doc->'categories') WITH ORDINALITY AS c(cat,ord)
    CROSS JOIN LATERAL (
      SELECT COALESCE(jsonb_agg(t.i ORDER BY t.o) FILTER (WHERE NOT t.hide),'[]'::jsonb) AS kept,
             count(*) AS total, count(*) FILTER (WHERE NOT t.hide) AS kept_n
      FROM (
        SELECT e.i, e.o, (e.i ? 'id' AND (e.i->>'id')=ANY(v_hidden)) AS hide
        FROM jsonb_array_elements(
          CASE WHEN jsonb_typeof(c.cat->'items')='array' THEN c.cat->'items' ELSE '[]'::jsonb END
        ) WITH ORDINALITY AS e(i,o)
      ) t
    ) f
    WHERE f.total=0 OR f.kept_n>0
  ) x;
  RETURN jsonb_set(p_doc,'{categories}',v_cats);
END $$;
REVOKE ALL ON FUNCTION app_private.plan_filter_document(text,jsonb) FROM PUBLIC;

-- The public catalog (menu page, order validation, POS) is built here, so one filter covers all of them.
CREATE OR REPLACE FUNCTION app_private.free_menu_public(p_token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT jsonb_build_object('outlet',jsonb_build_object('id',r.id,'name',r.name,'currency',r.currency,'timezone',r.timezone,'outletType',r.outlet_type,'fulfillmentModes',r.fulfillment_modes,'isDemoData',r.is_demo_data,'versioned',r.free_menu_enabled),'point',t.label,'now',statement_timestamp(),
 'menus',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',m.id,'revision',rel.revision,'document',app_private.plan_filter_document(r.id,rel.document),'brand',b.name,'overrides',COALESCE((SELECT jsonb_agg(jsonb_build_object('dishId',o.dish_id,'priceMinor',o.price_minor,'soldOut',o.sold_out)) FROM menu_overrides o WHERE o.menu_id=m.id AND o.outlet_id=r.id),'[]'::jsonb))) FROM menu_assignments a JOIN menus m ON m.id=a.menu_id JOIN menu_releases rel ON rel.menu_id=m.id AND rel.revision=m.published_revision LEFT JOIN brands b ON b.id=a.brand_id WHERE a.outlet_id=r.id AND NOT m.archived),'[]'::jsonb))
 FROM qr_codes q JOIN restaurants r ON r.id=q.restaurant_id JOIN organizations org ON org.id=r.organization_id LEFT JOIN restaurant_tables t ON t.id=q.table_id AND t.restaurant_id=r.id
 WHERE q.destination_token=p_token AND q.is_active AND r.is_active AND r.is_published AND org.is_active LIMIT 1
$$;
REVOKE ALL ON FUNCTION app_private.free_menu_public(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.free_menu_public(text) TO menuminute_app;

-- Worker-only sweep. p_caps maps plan rank to the dish cap, e.g. {"0":20,"1":200,"2":2000}; the
-- caps live in the reviewed application catalog, never in SQL. A missing key means uncapped.
-- Returns the ids of outlets whose hidden set changed.
CREATE FUNCTION app_private.reconcile_plan_overflow(p_caps jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  s app_private.plan_settings%ROWTYPE; r record; o app_private.plan_overflow%ROWTYPE;
  v_rank integer; v_cap integer; v_cnt integer; v_hide text[]; v_old text[]; n integer;
  v_changed text[]:='{}';
BEGIN
  IF NOT pg_try_advisory_xact_lock(hashtextextended('plan-overflow-reconcile',0)) THEN
    RETURN '[]'::jsonb;
  END IF;
  SELECT * INTO s FROM app_private.plan_settings WHERE singleton;
  FOR r IN SELECT id, organization_id FROM restaurants WHERE is_active LOOP
    v_rank:=app_private.plan_rank(r.organization_id);
    v_cap:=CASE WHEN v_rank>=99 THEN NULL ELSE NULLIF(p_caps->>v_rank::text,'')::integer END;
    v_cnt:=NULL;
    IF s.overflow_hiding_enabled AND v_cap IS NOT NULL THEN
      SELECT count(*)::integer INTO v_cnt FROM app_private.plan_published_dishes(r.id);
    END IF;
    -- Inert (switch off, uncapped plan) or within the cap: clear any tracking and hidden rows.
    IF v_cnt IS NULL OR v_cnt<=v_cap THEN
      DELETE FROM app_private.plan_hidden_dishes WHERE outlet_id=r.id;
      GET DIAGNOSTICS n=ROW_COUNT;
      IF n>0 THEN v_changed:=v_changed||r.id; END IF;
      DELETE FROM app_private.plan_overflow WHERE outlet_id=r.id;
      CONTINUE;
    END IF;
    SELECT * INTO o FROM app_private.plan_overflow WHERE outlet_id=r.id;
    -- New overflow, or the plan/cap changed under it: restart the grace period.
    IF NOT FOUND OR o.plan_rank<>v_rank OR o.cap<>v_cap THEN
      INSERT INTO app_private.plan_overflow(outlet_id,plan_rank,cap,published_count,first_over_at,grace_until)
      VALUES(r.id,v_rank,v_cap,v_cnt,now(),now()+make_interval(days=>s.overflow_grace_days))
      ON CONFLICT (outlet_id) DO UPDATE SET plan_rank=EXCLUDED.plan_rank,cap=EXCLUDED.cap,
        published_count=EXCLUDED.published_count,first_over_at=EXCLUDED.first_over_at,
        grace_until=EXCLUDED.grace_until,hidden_at=NULL,updated_at=now();
      DELETE FROM app_private.plan_hidden_dishes WHERE outlet_id=r.id;
      GET DIAGNOSTICS n=ROW_COUNT;
      IF n>0 THEN v_changed:=v_changed||r.id; END IF;
      CONTINUE;
    END IF;
    UPDATE app_private.plan_overflow SET published_count=v_cnt,updated_at=now() WHERE outlet_id=r.id;
    -- Still inside the grace period: nothing hidden yet.
    IF now()<o.grace_until THEN
      DELETE FROM app_private.plan_hidden_dishes WHERE outlet_id=r.id;
      GET DIAGNOSTICS n=ROW_COUNT;
      IF n>0 THEN v_changed:=v_changed||r.id; END IF;
      CONTINUE;
    END IF;
    -- Grace is over: hide every live dish beyond the first v_cap, in menu order.
    SELECT array_agg(d.dish_id ORDER BY d.dish_id) INTO v_hide
      FROM app_private.plan_published_dishes(r.id) d WHERE d.ord>v_cap;
    SELECT array_agg(h.dish_id ORDER BY h.dish_id) INTO v_old
      FROM app_private.plan_hidden_dishes h WHERE h.outlet_id=r.id;
    IF v_hide IS DISTINCT FROM v_old THEN
      DELETE FROM app_private.plan_hidden_dishes WHERE outlet_id=r.id;
      INSERT INTO app_private.plan_hidden_dishes(outlet_id,dish_id,plan_rank)
        SELECT r.id,x,v_rank FROM unnest(v_hide) AS x;
      v_changed:=v_changed||r.id;
    END IF;
    UPDATE app_private.plan_overflow SET hidden_at=COALESCE(hidden_at,now()) WHERE outlet_id=r.id;
  END LOOP;
  RETURN to_jsonb(v_changed);
END $$;
REVOKE ALL ON FUNCTION app_private.reconcile_plan_overflow(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.reconcile_plan_overflow(jsonb) TO menuminute_worker;

-- What the owner may see: the cap, when the grace ends and how many dishes are hidden right now.
-- NULL unless the switch is on, the outlet is over its cap and the caller can read its menu.
CREATE FUNCTION app_private.plan_overflow_snapshot(p_outlet text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT CASE WHEN app_private.can_outlet(p_outlet,'menu.read') THEN (
    SELECT jsonb_build_object(
      'cap',o.cap,'count',o.published_count,'graceUntil',o.grace_until,
      'hidden',(SELECT count(*) FROM app_private.plan_hidden_dishes h
                WHERE h.outlet_id=o.outlet_id AND h.plan_rank>=app_private.plan_rank(r.organization_id)))
    FROM app_private.plan_overflow o
    JOIN restaurants r ON r.id=o.outlet_id
    JOIN app_private.plan_settings s ON s.singleton AND s.overflow_hiding_enabled
    WHERE o.outlet_id=p_outlet
  ) END
$$;
REVOKE ALL ON FUNCTION app_private.plan_overflow_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.plan_overflow_snapshot(text) TO menuminute_app;
