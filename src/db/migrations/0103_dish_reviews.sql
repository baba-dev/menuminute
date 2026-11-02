-- Verified dish ratings and moderated comments. Forward-only, additive, after 0102.
-- A rating can only be created through the order's own tracking capability once the order is served
-- or collected, one per ordered line. Star ratings count immediately; a written comment is shown
-- only after a manager approves it. The public demo tenant never stores reviews (its orders are
-- deleted on reset and these rows reference them with RESTRICT).
CREATE TABLE dish_reviews (
 id text PRIMARY KEY,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
 order_id text NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
 order_item_id text NOT NULL UNIQUE REFERENCES order_items(id) ON DELETE RESTRICT,
 dish_id text NOT NULL,
 rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
 comment text NOT NULL DEFAULT '' CHECK (length(comment) <= 400),
 display_name text NOT NULL DEFAULT '' CHECK (length(display_name) <= 40),
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','removed')),
 comment_status text NOT NULL DEFAULT 'none'
   CHECK (comment_status IN ('none','pending','published','hidden')),
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 moderated_by text REFERENCES users(id),
 moderated_at timestamptz,
 CHECK ((comment = '' AND comment_status = 'none') OR (comment <> '' AND comment_status <> 'none'))
);
CREATE INDEX dish_reviews_outlet_queue ON dish_reviews(outlet_id,comment_status,created_at DESC);
CREATE INDEX dish_reviews_dish_published ON dish_reviews(outlet_id,dish_id,created_at DESC)
  WHERE status='active' AND comment_status='published';
ALTER TABLE dish_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dish_reviews FROM PUBLIC, menuminute_app, menuminute_worker;

CREATE TABLE dish_rating_aggregates (
 outlet_id text NOT NULL REFERENCES restaurants(id) ON DELETE RESTRICT,
 organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
 dish_id text NOT NULL,
 rating_count integer NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
 rating_sum integer NOT NULL DEFAULT 0 CHECK (rating_sum >= 0),
 PRIMARY KEY (outlet_id, dish_id)
);
ALTER TABLE dish_rating_aggregates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON dish_rating_aggregates FROM PUBLIC, menuminute_app, menuminute_worker;

-- Resolve the active outlet for a public menu token (same rule as the other guest functions).
CREATE FUNCTION app_private.review_outlet(p_token text)
RETURNS TABLE(outlet_id text, organization_id text, is_demo boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT r.id,r.organization_id,r.is_demo_data FROM qr_codes q
 JOIN restaurants r ON r.id=q.restaurant_id AND r.is_active
 JOIN organizations o ON o.id=r.organization_id AND o.is_active
 WHERE q.destination_token=p_token AND q.is_active LIMIT 1
$fn$;
REVOKE ALL ON FUNCTION app_private.review_outlet(text) FROM PUBLIC;

CREATE FUNCTION app_private.guest_review_state(p_token text, p_order text, p_tracking text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o record; v_order orders%ROWTYPE; eligible boolean; lines jsonb;
BEGIN
 SELECT * INTO o FROM app_private.review_outlet(p_token);
 IF o.outlet_id IS NULL THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_order FROM orders
 WHERE id=p_order AND restaurant_id=o.outlet_id AND tracking_token=p_tracking;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 eligible := NOT o.is_demo AND v_order.status IN ('served','collected')
   AND v_order.updated_at > clock_timestamp()-interval '14 days';
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'orderItemId',i.id,'dishId',i.dish_id,'name',i.item_name,
   'rating',r.rating,'comment',r.comment,'commentStatus',r.comment_status
  ) ORDER BY i.id),'[]'::jsonb) INTO lines
 FROM order_items i
 LEFT JOIN dish_reviews r ON r.order_item_id=i.id AND r.status='active'
 WHERE i.order_id=p_order AND i.restaurant_id=o.outlet_id;
 RETURN jsonb_build_object('eligible',eligible,'items',lines);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_review_state(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_review_state(text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.guest_review_submit(
 p_token text, p_order text, p_tracking text, p_item text, p_rating integer,
 p_comment text, p_name text
) RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o record; v_order orders%ROWTYPE; it order_items%ROWTYPE; prior dish_reviews%ROWTYPE;
 cm text:=btrim(regexp_replace(coalesce(p_comment,''),'[[:cntrl:]]',' ','g'));
 nm text:=btrim(regexp_replace(coalesce(p_name,''),'[[:cntrl:]]',' ','g')); rid text;
BEGIN
 IF p_rating IS NULL OR p_rating NOT BETWEEN 1 AND 5 OR length(cm)>400 OR length(nm)>40
    OR p_item IS NULL THEN
   RAISE EXCEPTION 'Invalid review' USING ERRCODE='22023';
 END IF;
 SELECT * INTO o FROM app_private.review_outlet(p_token);
 IF o.outlet_id IS NULL THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 IF o.is_demo THEN RAISE EXCEPTION 'The public demo does not store reviews' USING ERRCODE='22023'; END IF;
 SELECT * INTO v_order FROM orders
 WHERE id=p_order AND restaurant_id=o.outlet_id AND tracking_token=p_tracking FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Tracking session unavailable' USING ERRCODE='42501'; END IF;
 IF v_order.status NOT IN ('served','collected')
    OR v_order.updated_at <= clock_timestamp()-interval '14 days' THEN
   RAISE EXCEPTION 'Reviews open once the order is served' USING ERRCODE='22023';
 END IF;
 SELECT * INTO it FROM order_items WHERE id=p_item AND order_id=p_order AND restaurant_id=o.outlet_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Order item not found' USING ERRCODE='22023'; END IF;
 -- The order row lock above serializes concurrent submissions for the same order.
 SELECT * INTO prior FROM dish_reviews WHERE order_item_id=p_item;
 IF FOUND THEN
   RETURN jsonb_build_object('reviewId',prior.id,'duplicate',true);
 END IF;
 rid:=gen_random_uuid()::text;
 INSERT INTO dish_reviews(id,organization_id,outlet_id,order_id,order_item_id,dish_id,rating,comment,
                          display_name,comment_status)
 VALUES(rid,o.organization_id,o.outlet_id,p_order,p_item,it.dish_id,p_rating,cm,nm,
        CASE WHEN cm='' THEN 'none' ELSE 'pending' END);
 INSERT INTO dish_rating_aggregates(outlet_id,organization_id,dish_id,rating_count,rating_sum)
 VALUES(o.outlet_id,o.organization_id,it.dish_id,1,p_rating)
 ON CONFLICT (outlet_id,dish_id) DO UPDATE SET
   rating_count=dish_rating_aggregates.rating_count+1,
   rating_sum=dish_rating_aggregates.rating_sum+EXCLUDED.rating_sum;
 RETURN jsonb_build_object('reviewId',rid,'duplicate',false);
END $fn$;
REVOKE ALL ON FUNCTION app_private.guest_review_submit(text,text,text,text,integer,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.guest_review_submit(text,text,text,text,integer,text,text) TO menuminute_app;

-- Public aggregates: only dishes with at least p_min ratings are shown, so one rating never
-- identifies a diner or sinks a dish.
CREATE FUNCTION app_private.public_dish_ratings(p_token text, p_min integer)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o record; result jsonb;
BEGIN
 SELECT * INTO o FROM app_private.review_outlet(p_token);
 IF o.outlet_id IS NULL THEN RETURN '{}'::jsonb; END IF;
 SELECT COALESCE(jsonb_object_agg(a.dish_id,jsonb_build_object(
   'count',a.rating_count,'average',round(a.rating_sum::numeric/a.rating_count,1))),'{}'::jsonb)
 INTO result FROM dish_rating_aggregates a
 WHERE a.outlet_id=o.outlet_id AND a.rating_count>=greatest(coalesce(p_min,3),1);
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.public_dish_ratings(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.public_dish_ratings(text,integer) TO menuminute_app;

CREATE FUNCTION app_private.public_dish_reviews(p_token text, p_dish text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE o record; result jsonb;
BEGIN
 SELECT * INTO o FROM app_private.review_outlet(p_token);
 IF o.outlet_id IS NULL OR p_dish IS NULL THEN RETURN '[]'::jsonb; END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'rating',q.rating,'comment',q.comment,'name',q.display_name,'at',q.created_at
  ) ORDER BY q.created_at DESC),'[]'::jsonb) INTO result FROM (
   SELECT rating,comment,display_name,created_at FROM dish_reviews
   WHERE outlet_id=o.outlet_id AND dish_id=p_dish AND status='active' AND comment_status='published'
   ORDER BY created_at DESC LIMIT 5
 ) q;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.public_dish_reviews(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.public_dish_reviews(text,text) TO menuminute_app;

CREATE FUNCTION app_private.staff_review_queue(p_org text, p_outlet text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE result jsonb;
BEGIN
 IF current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'outlet.manage')
 OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT COALESCE(jsonb_agg(jsonb_build_object(
   'id',q.id,'dishId',q.dish_id,'dishName',q.item_name,'rating',q.rating,'comment',q.comment,
   'name',q.display_name,'status',q.status,'commentStatus',q.comment_status,'createdAt',q.created_at
  ) ORDER BY q.created_at DESC),'[]'::jsonb) INTO result FROM (
   SELECT r.id,r.dish_id,i.item_name,r.rating,r.comment,r.display_name,r.status,r.comment_status,r.created_at
   FROM dish_reviews r JOIN order_items i ON i.id=r.order_item_id
   WHERE r.outlet_id=p_outlet AND r.organization_id=p_org AND r.status='active'
     AND (r.comment_status IN ('pending','published','hidden') OR r.created_at>clock_timestamp()-interval '30 days')
   ORDER BY (r.comment_status='pending') DESC, r.created_at DESC LIMIT 100
 ) q;
 RETURN result;
END $fn$;
REVOKE ALL ON FUNCTION app_private.staff_review_queue(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.staff_review_queue(text,text) TO menuminute_app;

CREATE FUNCTION app_private.staff_review_action(p_org text, p_outlet text, p_review text, p_action text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $fn$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); r dish_reviews%ROWTYPE;
BEGIN
 IF actor IS NULL OR p_action NOT IN ('publish_comment','hide_comment','remove')
 OR current_setting('app.outlet_id',true) IS DISTINCT FROM p_outlet
 OR NOT app_private.can_outlet(p_outlet,'outlet.manage')
 OR NOT EXISTS(SELECT 1 FROM restaurants WHERE id=p_outlet AND organization_id=p_org AND is_active) THEN
   RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
 END IF;
 SELECT * INTO r FROM dish_reviews WHERE id=p_review AND outlet_id=p_outlet AND organization_id=p_org FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Review not found' USING ERRCODE='22023'; END IF;
 IF r.status='removed' THEN RETURN jsonb_build_object('id',r.id,'status','removed'); END IF;
 IF p_action='remove' THEN
   UPDATE dish_reviews SET status='removed',comment_status=CASE WHEN comment='' THEN 'none' ELSE 'hidden' END,
     moderated_by=actor,moderated_at=clock_timestamp() WHERE id=r.id;
   UPDATE dish_rating_aggregates SET rating_count=greatest(rating_count-1,0),
     rating_sum=greatest(rating_sum-r.rating,0)
   WHERE outlet_id=p_outlet AND dish_id=r.dish_id;
   RETURN jsonb_build_object('id',r.id,'status','removed');
 END IF;
 IF r.comment='' THEN RAISE EXCEPTION 'This rating has no comment' USING ERRCODE='22023'; END IF;
 UPDATE dish_reviews SET comment_status=CASE p_action WHEN 'publish_comment' THEN 'published' ELSE 'hidden' END,
   moderated_by=actor,moderated_at=clock_timestamp() WHERE id=r.id;
 RETURN jsonb_build_object('id',r.id,'status','active','commentStatus',
   CASE p_action WHEN 'publish_comment' THEN 'published' ELSE 'hidden' END);
END $fn$;
REVOKE ALL ON FUNCTION app_private.staff_review_action(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.staff_review_action(text,text,text,text) TO menuminute_app;
