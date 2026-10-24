-- Ember C: a single allowlisted availability override. No autonomous financial, order or publish actions.
CREATE TABLE assistant_action_proposals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 user_id text NOT NULL REFERENCES users(id),
 conversation_id text NOT NULL,
 request_key uuid NOT NULL,
 menu_id text NOT NULL,
 dish_id text NOT NULL,
 dish_name text NOT NULL CHECK(length(dish_name) BETWEEN 1 AND 100),
 menu_name text NOT NULL CHECK(length(menu_name) BETWEEN 1 AND 100),
 previous_sold_out boolean NOT NULL,
 desired_sold_out boolean NOT NULL,
 expected_revision integer NOT NULL CHECK(expected_revision>0),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','rejected','stale')),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '10 minutes'),
 decided_at timestamptz,
 decision_key uuid,
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (conversation_id,organization_id,outlet_id,user_id) REFERENCES assistant_conversations(id,organization_id,outlet_id,user_id) ON DELETE RESTRICT,
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT,
 CONSTRAINT assistant_proposal_request UNIQUE(user_id,outlet_id,request_key),
 CHECK(previous_sold_out<>desired_sold_out),
 CHECK ((status='pending' AND decision_key IS NULL AND decided_at IS NULL AND result IS NULL)
    OR (status<>'pending' AND decision_key IS NOT NULL AND decided_at IS NOT NULL AND result IS NOT NULL))
);
CREATE INDEX assistant_action_owner ON assistant_action_proposals(user_id,outlet_id,created_at DESC);
CREATE INDEX assistant_action_pending ON assistant_action_proposals(conversation_id,created_at DESC) WHERE status='pending';
ALTER TABLE assistant_action_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_action_proposals FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_action_owner_read ON assistant_action_proposals FOR SELECT TO menuminute_app
 USING (app_private.ai_scope(organization_id,outlet_id,user_id) AND
        app_private.can_outlet(outlet_id,'menu.write'));
REVOKE ALL ON assistant_action_proposals FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT SELECT ON assistant_action_proposals TO menuminute_app;

CREATE FUNCTION app_private.ai_propose_availability(p_org text,p_outlet text,p_conversation text,
 p_menu text,p_dish text,p_sold_out boolean,p_key uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); p assistant_action_proposals%ROWTYPE;
 m menus%ROWTYPE; dish jsonb; o menu_overrides%ROWTYPE; before_value boolean; menu_name text;
BEGIN
 IF NOT app_private.ai_scope(p_org,p_outlet,actor) OR NOT app_private.can_outlet(p_outlet,'menu.write')
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM assistant_conversations WHERE id=p_conversation AND user_id=actor
   AND organization_id=p_org AND outlet_id=p_outlet) THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM assistant_action_proposals WHERE user_id=actor AND outlet_id=p_outlet AND request_key=p_key;
 IF FOUND THEN
  IF p.organization_id<>p_org OR p.conversation_id<>p_conversation OR p.menu_id<>p_menu
    OR p.dish_id<>p_dish OR p.desired_sold_out<>p_sold_out THEN
   RAISE EXCEPTION 'Request key conflict' USING ERRCODE='40001'; END IF;
  RETURN jsonb_build_object('id',p.id,'status',p.status,'menuId',p.menu_id,'menuName',p.menu_name,
    'dishId',p.dish_id,'dishName',p.dish_name,'beforeSoldOut',p.previous_sold_out,
    'desiredSoldOut',p.desired_sold_out,'expectedRevision',p.expected_revision,'expiresAt',p.expires_at,'result',p.result);
 END IF;
 SELECT * INTO m FROM menus WHERE id=p_menu AND organization_id=p_org AND NOT archived
   AND published_revision IS NOT NULL
   AND EXISTS(SELECT 1 FROM menu_assignments WHERE menu_id=p_menu AND outlet_id=p_outlet) FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Published assigned menu required' USING ERRCODE='22023'; END IF;
 IF NOT app_private.menu_access(p_menu,'menu.write') THEN RAISE EXCEPTION 'Menu write permission required' USING ERRCODE='42501'; END IF;
 SELECT i.value INTO dish FROM menu_releases rel,
   jsonb_array_elements(rel.document->'categories') c,
   jsonb_array_elements(c.value->'items') i
 WHERE rel.menu_id=p_menu AND rel.revision=m.published_revision
   AND c.value->>'archived'='false' AND i.value->>'archived'='false'
   AND i.value->>'id'=p_dish LIMIT 1;
 IF dish IS NULL OR NOT EXISTS(
   SELECT 1 FROM menu_releases rel,
     jsonb_array_elements(rel.document->'categories') c,
     jsonb_array_elements(c.value->'items') i
   WHERE rel.menu_id=p_menu AND rel.revision=m.published_revision
     AND c.value->>'archived'='false' AND i.value->>'archived'='false'
     AND i.value->>'id'=p_dish
 ) THEN RAISE EXCEPTION 'Dish not in the current published menu' USING ERRCODE='22023'; END IF;
 SELECT * INTO o FROM menu_overrides WHERE menu_id=p_menu AND outlet_id=p_outlet AND dish_id=p_dish;
 before_value:=coalesce(o.sold_out,(dish->>'soldOut')::boolean,false);
 IF before_value=p_sold_out THEN RAISE EXCEPTION 'Dish already has requested availability' USING ERRCODE='22023'; END IF;
 menu_name:=left(m.document->>'name',100);
 INSERT INTO assistant_action_proposals(organization_id,outlet_id,user_id,conversation_id,request_key,
   menu_id,dish_id,dish_name,menu_name,previous_sold_out,desired_sold_out,expected_revision)
 VALUES(p_org,p_outlet,actor,p_conversation,p_key,p_menu,p_dish,left(dish->>'name',100),
   menu_name,before_value,p_sold_out,m.revision) RETURNING * INTO p;
 RETURN jsonb_build_object('id',p.id,'status',p.status,'menuId',p.menu_id,'menuName',p.menu_name,
   'dishId',p.dish_id,'dishName',p.dish_name,'beforeSoldOut',p.previous_sold_out,
   'desiredSoldOut',p.desired_sold_out,'expectedRevision',p.expected_revision,'expiresAt',p.expires_at,'result',p.result);
END $$;
REVOKE ALL ON FUNCTION app_private.ai_propose_availability(text,text,text,text,text,boolean,uuid) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_propose_availability(text,text,text,text,text,boolean,uuid) TO menuminute_app;

CREATE FUNCTION app_private.ai_decide_action(p_org text,p_outlet text,p_proposal uuid,p_key uuid,p_decision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); p assistant_action_proposals%ROWTYPE;
 m menus%ROWTYPE; value jsonb; actual boolean; original_price integer; outcome jsonb; receipt jsonb;
BEGIN
 IF p_decision NOT IN ('confirm','reject') OR NOT app_private.ai_scope(p_org,p_outlet,actor)
   OR NOT app_private.can_outlet(p_outlet,'menu.write') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM assistant_action_proposals WHERE id=p_proposal AND organization_id=p_org
 AND outlet_id=p_outlet AND user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Proposal unavailable' USING ERRCODE='42501'; END IF;
 IF p.status<>'pending' THEN
   IF p.decision_key=p_key AND (p.status='confirmed' AND p_decision='confirm'
      OR p.status='rejected' AND p_decision='reject'
      OR p.status='stale' AND p_decision='confirm') THEN
     RETURN p.result;
   END IF;
   RAISE EXCEPTION 'Proposal already decided' USING ERRCODE='40001';
 END IF;
 IF p.expires_at<=now() THEN RAISE EXCEPTION 'Proposal expired' USING ERRCODE='40001'; END IF;
 IF p_decision='reject' THEN
   receipt:=jsonb_build_object('id',p.id,'status','rejected','message','No change was made');
 ELSE
   -- Follow the domain menu_command lock order (organization before menu).
   PERFORM 1 FROM organizations WHERE id=p_org FOR UPDATE;
   SELECT * INTO m FROM menus WHERE id=p.menu_id AND organization_id=p_org
     AND NOT archived AND published_revision IS NOT NULL FOR UPDATE;
   IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM menu_assignments WHERE menu_id=p.menu_id AND outlet_id=p_outlet)
      OR NOT app_private.menu_access(p.menu_id,'menu.write') THEN
      RAISE EXCEPTION 'Menu access changed' USING ERRCODE='42501'; END IF;
   IF m.revision<>p.expected_revision THEN
     receipt:=jsonb_build_object('id',p.id,'status','stale','message','Menu changed. Create a new proposal');
   ELSE
     SELECT i.value INTO value FROM menu_releases rel,
       jsonb_array_elements(rel.document->'categories') c,
       jsonb_array_elements(c.value->'items') i WHERE rel.menu_id=p.menu_id
       AND rel.revision=m.published_revision AND i.value->>'id'=p.dish_id
       AND c.value->>'archived'='false' AND i.value->>'archived'='false' LIMIT 1;
     IF value IS NULL THEN RAISE EXCEPTION 'Dish no longer available' USING ERRCODE='40001'; END IF;
     SELECT coalesce(o.sold_out,(value->>'soldOut')::boolean,false),o.price_minor
       INTO actual,original_price FROM (SELECT 1) anchor LEFT JOIN menu_overrides o
       ON o.menu_id=p.menu_id AND o.outlet_id=p_outlet AND o.dish_id=p.dish_id;
     IF actual<>p.previous_sold_out THEN
       receipt:=jsonb_build_object('id',p.id,'status','stale','message','Availability changed. Create a new proposal');
     ELSE
       SELECT app_private.menu_command(p_outlet,p.menu_id,'override',
         jsonb_build_object('outletId',p_outlet,'dishId',p.dish_id,'priceMinor',original_price,'soldOut',p.desired_sold_out),
         'ember:'||p.id::text,p.expected_revision) INTO outcome;
       receipt:=jsonb_build_object('id',p.id,'status','confirmed','menuId',p.menu_id,
         'dishId',p.dish_id,'dishName',p.dish_name,'soldOut',p.desired_sold_out,'result',outcome);
     END IF;
   END IF;
 END IF;
 UPDATE assistant_action_proposals SET status=receipt->>'status',decision_key=p_key,
   decided_at=now(),result=receipt WHERE id=p.id;
 RETURN receipt;
END $$;
REVOKE ALL ON FUNCTION app_private.ai_decide_action(text,text,uuid,uuid,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_decide_action(text,text,uuid,uuid,text) TO menuminute_app;
