-- Ember: generic confirm-first action requests. The model may only PROPOSE; a human confirms.
-- This table stores what was proposed (kind + validated params + a plain-language summary), the
-- state the proposal was based on, and the outcome. The business change itself is performed by the
-- existing domain command (which re-checks permission and uses its own optimistic version), so this
-- table never grants authority. Additive: the earlier availability proposals table is untouched.
--
-- Demo reset note: rows are removed with their conversation (ON DELETE CASCADE), which the demo
-- reset already deletes; tests/demo-reset.test.ts lists the table under PRESERVED for that reason.
CREATE TABLE assistant_action_requests (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 user_id text NOT NULL REFERENCES users(id),
 conversation_id text NOT NULL,
 request_key uuid NOT NULL,
 kind text NOT NULL CHECK(kind IN (
  'service_request.acknowledge','service_request.resolve','order.transition',
  'kitchen.work','menu.price','menu.description')),
 params jsonb NOT NULL CHECK(jsonb_typeof(params)='object' AND pg_column_size(params)<=4096),
 expected jsonb NOT NULL DEFAULT '{}'::jsonb CHECK(jsonb_typeof(expected)='object' AND pg_column_size(expected)<=2048),
 summary text NOT NULL CHECK(length(summary) BETWEEN 1 AND 300),
 status text NOT NULL DEFAULT 'pending'
  CHECK(status IN ('pending','confirming','confirmed','rejected','stale','failed')),
 expires_at timestamptz NOT NULL DEFAULT (now()+interval '10 minutes'),
 decision_key uuid,
 decided_at timestamptz,
 result jsonb,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY (conversation_id,organization_id,outlet_id,user_id)
  REFERENCES assistant_conversations(id,organization_id,outlet_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT,
 CONSTRAINT assistant_action_request_key UNIQUE(user_id,outlet_id,request_key),
 CHECK((status='pending' AND decision_key IS NULL AND decided_at IS NULL AND result IS NULL)
    OR (status='confirming' AND decision_key IS NOT NULL AND decided_at IS NULL AND result IS NULL)
    OR (status IN('confirmed','rejected','stale','failed')
        AND decision_key IS NOT NULL AND decided_at IS NOT NULL AND result IS NOT NULL))
);
CREATE INDEX assistant_action_requests_owner ON assistant_action_requests(user_id,outlet_id,created_at DESC);
CREATE INDEX assistant_action_requests_pending ON assistant_action_requests(conversation_id,created_at DESC)
 WHERE status IN ('pending','confirming');
ALTER TABLE assistant_action_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE assistant_action_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY assistant_action_requests_read ON assistant_action_requests FOR SELECT TO menuminute_app
 USING (app_private.ai_scope(organization_id,outlet_id,user_id));
-- SECURITY DEFINER functions run as the migration owner; see 0064 for why it needs a policy.
CREATE POLICY ai_definer_assistant_action_requests ON assistant_action_requests
 FOR ALL TO CURRENT_USER USING (true) WITH CHECK (true);
REVOKE ALL ON assistant_action_requests FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT SELECT ON assistant_action_requests TO menuminute_app;

-- Create (or replay) a pending request. p_permission is the permission the DOMAIN command will
-- require; it is checked here so a user cannot even preview an action they could not perform.
CREATE FUNCTION app_private.ai_propose_action(
 p_org text,p_outlet text,p_conversation text,p_kind text,p_params jsonb,p_expected jsonb,
 p_summary text,p_permission text,p_key uuid
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); r assistant_action_requests%ROWTYPE;
BEGIN
 IF NOT app_private.ai_scope(p_org,p_outlet,actor) OR p_permission IS NULL
    OR NOT app_private.can_outlet(p_outlet,p_permission)
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 IF NOT EXISTS(SELECT 1 FROM assistant_conversations WHERE id=p_conversation AND user_id=actor
   AND organization_id=p_org AND outlet_id=p_outlet)
 THEN RAISE EXCEPTION 'Conversation unavailable' USING ERRCODE='42501'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('ai-action-requests:'||actor,0));
 SELECT * INTO r FROM assistant_action_requests WHERE user_id=actor AND outlet_id=p_outlet AND request_key=p_key;
 IF FOUND THEN
  IF r.organization_id<>p_org OR r.conversation_id<>p_conversation OR r.kind<>p_kind
     OR r.params<>p_params THEN RAISE EXCEPTION 'Request key conflict' USING ERRCODE='40001'; END IF;
 ELSE
  IF (SELECT count(*) FROM assistant_action_requests WHERE user_id=actor
      AND created_at>=now()-interval '24 hours')>=60
  THEN RAISE EXCEPTION 'Assistant action preview limit reached' USING ERRCODE='22023'; END IF;
  IF (SELECT count(*) FROM assistant_action_requests WHERE conversation_id=p_conversation
      AND status='pending' AND expires_at>now())>=5
  THEN RAISE EXCEPTION 'Too many pending assistant actions' USING ERRCODE='22023'; END IF;
  INSERT INTO assistant_action_requests(organization_id,outlet_id,user_id,conversation_id,request_key,
    kind,params,expected,summary)
  VALUES(p_org,p_outlet,actor,p_conversation,p_key,p_kind,p_params,coalesce(p_expected,'{}'::jsonb),
    left(p_summary,300)) RETURNING * INTO r;
 END IF;
 RETURN jsonb_build_object('id',r.id,'status',r.status,'kind',r.kind,'summary',r.summary,
   'expiresAt',r.expires_at,'result',r.result);
END $$;
REVOKE ALL ON FUNCTION app_private.ai_propose_action(text,text,text,text,jsonb,jsonb,text,text,uuid)
 FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_propose_action(text,text,text,text,jsonb,jsonb,text,text,uuid)
 TO menuminute_app;

-- Step 1 of a decision. 'reject' finishes immediately. 'confirm' atomically moves pending ->
-- confirming (so two clicks cannot both run) and hands the stored params back to the server.
-- A repeated call with the same key replays: claimed=true again while confirming (crash retry),
-- or the stored result once finished.
CREATE FUNCTION app_private.ai_claim_action(p_org text,p_outlet text,p_id uuid,p_key uuid,p_decision text,
 p_permission text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); r assistant_action_requests%ROWTYPE;
BEGIN
 IF p_decision NOT IN ('confirm','reject') OR NOT app_private.ai_scope(p_org,p_outlet,actor)
    OR p_permission IS NULL OR NOT app_private.can_outlet(p_outlet,p_permission)
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 SELECT * INTO r FROM assistant_action_requests WHERE id=p_id AND organization_id=p_org
   AND outlet_id=p_outlet AND user_id=actor FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request unavailable' USING ERRCODE='42501'; END IF;
 IF r.status='pending' THEN
  IF r.expires_at<=now() THEN RAISE EXCEPTION 'Request expired' USING ERRCODE='40001'; END IF;
  IF p_decision='reject' THEN
   UPDATE assistant_action_requests SET status='rejected',decision_key=p_key,decided_at=now(),
     result=jsonb_build_object('id',r.id,'status','rejected','message','No change was made')
   WHERE id=r.id RETURNING * INTO r;
   RETURN jsonb_build_object('claimed',false,'result',r.result);
  END IF;
  UPDATE assistant_action_requests SET status='confirming',decision_key=p_key WHERE id=r.id RETURNING * INTO r;
  RETURN jsonb_build_object('claimed',true,'kind',r.kind,'params',r.params,'expected',r.expected,'summary',r.summary);
 END IF;
 IF r.decision_key=p_key THEN
  IF r.status='confirming' AND p_decision='confirm' THEN
   RETURN jsonb_build_object('claimed',true,'kind',r.kind,'params',r.params,'expected',r.expected,'summary',r.summary);
  END IF;
  IF r.status<>'confirming' THEN RETURN jsonb_build_object('claimed',false,'result',r.result); END IF;
 END IF;
 RAISE EXCEPTION 'Request already decided' USING ERRCODE='40001';
END $$;
REVOKE ALL ON FUNCTION app_private.ai_claim_action(text,text,uuid,uuid,text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_claim_action(text,text,uuid,uuid,text,text) TO menuminute_app;

-- Step 2: record the outcome of the domain command. Only the claimant's key can finish it.
CREATE FUNCTION app_private.ai_finish_action(p_org text,p_outlet text,p_id uuid,p_key uuid,p_status text,
 p_result jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE actor text:=NULLIF(current_setting('app.actor_id',true),''); r assistant_action_requests%ROWTYPE;
BEGIN
 IF p_status NOT IN ('confirmed','stale','failed') OR p_result IS NULL
    OR jsonb_typeof(p_result)<>'object' OR pg_column_size(p_result)>4096
    OR NOT app_private.ai_scope(p_org,p_outlet,actor)
 THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
 UPDATE assistant_action_requests SET status=p_status,decided_at=now(),
   result=p_result||jsonb_build_object('id',id,'status',p_status)
 WHERE id=p_id AND organization_id=p_org AND outlet_id=p_outlet AND user_id=actor
   AND status='confirming' AND decision_key=p_key RETURNING * INTO r;
 IF NOT FOUND THEN RAISE EXCEPTION 'Request not awaiting completion' USING ERRCODE='40001'; END IF;
 RETURN r.result;
END $$;
REVOKE ALL ON FUNCTION app_private.ai_finish_action(text,text,uuid,uuid,text,jsonb) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_finish_action(text,text,uuid,uuid,text,jsonb) TO menuminute_app;
