-- Ember PR B. Additive storage. PR #154 reserves migration 0020; reconcile journal on merge.
-- No public role or worker access; every web operation sets actor and outlet transaction-locally.
CREATE FUNCTION app_private.ai_scope(p_org text,p_outlet text,p_actor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
 SELECT p_actor IS NOT NULL AND p_actor <> ''
 AND p_actor = NULLIF(current_setting('app.actor_id',true),'')
 AND p_outlet = NULLIF(current_setting('app.outlet_id',true),'')
 AND EXISTS (SELECT 1 FROM restaurants r JOIN organizations o ON o.id=r.organization_id
   WHERE r.id=p_outlet AND r.organization_id=p_org AND r.is_active AND o.is_active)
 AND (app_private.can_outlet(p_outlet,'menu.read') OR app_private.can_outlet(p_outlet,'orders.read'))
$$;
REVOKE ALL ON FUNCTION app_private.ai_scope(text,text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_scope(text,text,text) TO menuminute_app;

CREATE TABLE assistant_conversations (
 id text PRIMARY KEY,
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(organization_id,outlet_id) REFERENCES restaurants(organization_id,id) ON DELETE RESTRICT,
 CONSTRAINT assistant_conversation_scope UNIQUE(id,organization_id,outlet_id,user_id),
 CONSTRAINT assistant_conversation_request UNIQUE(user_id,outlet_id,request_key)
);
CREATE INDEX assistant_conversations_owner ON assistant_conversations(user_id,outlet_id,created_at DESC);
CREATE TABLE assistant_turns (
 id text PRIMARY KEY,
 conversation_id text NOT NULL,
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 user_id text NOT NULL,
 client_key uuid NOT NULL,
 request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
 prompt text NOT NULL CHECK(length(prompt) BETWEEN 1 AND 4000),
 status text NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','completed','failed')),
 answer text CHECK(length(answer)<=16000),
 evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
 error_code text CHECK(length(error_code)<=40),
 created_at timestamptz NOT NULL DEFAULT now(),
 completed_at timestamptz,
 FOREIGN KEY(conversation_id,organization_id,outlet_id,user_id)
  REFERENCES assistant_conversations(id,organization_id,outlet_id,user_id) ON DELETE RESTRICT,
 CONSTRAINT assistant_turn_scope UNIQUE(id,conversation_id,organization_id,outlet_id,user_id),
 CONSTRAINT assistant_turn_idempotency UNIQUE(conversation_id,client_key),
 CHECK ((status='processing' AND completed_at IS NULL AND answer IS NULL)
 OR (status='completed' AND completed_at IS NOT NULL AND answer IS NOT NULL AND error_code IS NULL)
 OR (status='failed' AND completed_at IS NOT NULL AND answer IS NULL AND error_code IS NOT NULL))
);
CREATE UNIQUE INDEX assistant_one_processing_turn ON assistant_turns(conversation_id) WHERE status='processing';
CREATE INDEX assistant_turns_actor_window ON assistant_turns(user_id,created_at DESC);
CREATE INDEX assistant_turns_history ON assistant_turns(conversation_id,created_at DESC);
CREATE TABLE assistant_attempts (
 id text PRIMARY KEY,
 turn_id text NOT NULL,
 conversation_id text NOT NULL,
 organization_id text NOT NULL,
 outlet_id text NOT NULL,
 user_id text NOT NULL,
 round smallint NOT NULL CHECK(round BETWEEN 1 AND 2),
 provider text NOT NULL CHECK(provider IN ('nvidia','cloudflare')),
 model text NOT NULL CHECK(length(model) BETWEEN 1 AND 128),
 status text NOT NULL DEFAULT 'started' CHECK(status IN ('started','completed','uncertain')),
 input_tokens integer CHECK(input_tokens>=0),
 output_tokens integer CHECK(output_tokens>=0),
 created_at timestamptz NOT NULL DEFAULT now(),
 settled_at timestamptz,
 FOREIGN KEY(turn_id,conversation_id,organization_id,outlet_id,user_id)
  REFERENCES assistant_turns(id,conversation_id,organization_id,outlet_id,user_id) ON DELETE RESTRICT,
 CONSTRAINT assistant_attempt_round UNIQUE(turn_id,round),
 CHECK ((status='started' AND settled_at IS NULL) OR (status<>'started' AND settled_at IS NOT NULL))
);
CREATE INDEX assistant_attempts_tenant_window ON assistant_attempts(organization_id,created_at DESC);
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['assistant_conversations','assistant_turns','assistant_attempts'] LOOP
 EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY',t);
 EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY',t);
 EXECUTE format('CREATE POLICY %I ON %I FOR ALL TO menuminute_app USING (app_private.ai_scope(organization_id,outlet_id,user_id)) WITH CHECK (app_private.ai_scope(organization_id,outlet_id,user_id))','ai_owner_'||t,t);
 EXECUTE format('REVOKE ALL ON %I FROM PUBLIC,menuminute_worker',t);
 EXECUTE format('GRANT SELECT,INSERT ON %I TO menuminute_app',t);
 END LOOP;
END $$;
-- Intentionally NO DELETE or TRUNCATE grant to web. Retention cleanup is a separately reviewed operator task.

-- Narrow update-column grants: no actor/scope/key/prompt/attempt identity can be rewritten.
GRANT UPDATE(updated_at) ON assistant_conversations TO menuminute_app;
GRANT UPDATE(status,answer,evidence,error_code,completed_at) ON assistant_turns TO menuminute_app;
GRANT UPDATE(status,input_tokens,output_tokens,settled_at) ON assistant_attempts TO menuminute_app;

-- Organization-wide daily quota cannot be counted through actor-only RLS.
-- This counter is completely inaccessible to web/worker roles except a scoped checked function.
CREATE TABLE assistant_org_daily_budget (
 organization_id text NOT NULL REFERENCES organizations(id),
 day date NOT NULL, attempts integer NOT NULL DEFAULT 0 CHECK(attempts BETWEEN 0 AND 80),
 PRIMARY KEY(organization_id,day)
);
REVOKE ALL ON assistant_org_daily_budget FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE FUNCTION app_private.ai_reserve_org_budget(p_org text,p_outlet text,p_actor text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.ai_scope(p_org,p_outlet,p_actor) THEN RETURN false; END IF;
 INSERT INTO assistant_org_daily_budget(organization_id,day,attempts)
 VALUES(p_org,(now() at time zone 'UTC')::date,1)
 ON CONFLICT(organization_id,day) DO UPDATE SET attempts=assistant_org_daily_budget.attempts+1
 WHERE assistant_org_daily_budget.attempts < 80;
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION app_private.ai_reserve_org_budget(text,text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_reserve_org_budget(text,text,text) TO menuminute_app;

-- Quota cannot be derived from a user's RLS-filtered view of just the active outlet.
-- Keep a private cross-outlet user budget: atomic UTC-day reservations, no web SELECT privilege.
CREATE TABLE assistant_user_daily_budget (
 user_id text NOT NULL REFERENCES users(id),
 day date NOT NULL,
 conversations integer NOT NULL DEFAULT 0 CHECK(conversations BETWEEN 0 AND 12),
 turns integer NOT NULL DEFAULT 0 CHECK(turns BETWEEN 0 AND 20),
 PRIMARY KEY(user_id,day)
);
REVOKE ALL ON assistant_user_daily_budget FROM PUBLIC,menuminute_app,menuminute_worker;
CREATE FUNCTION app_private.ai_reserve_user_budget(p_org text,p_outlet text,p_actor text,p_kind text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
 IF NOT app_private.ai_scope(p_org,p_outlet,p_actor) OR p_kind NOT IN ('conversation','turn') THEN RETURN false; END IF;
 INSERT INTO assistant_user_daily_budget(user_id,day,conversations,turns)
 VALUES(p_actor,(now() at time zone 'UTC')::date,
        CASE WHEN p_kind='conversation' THEN 1 ELSE 0 END,
        CASE WHEN p_kind='turn' THEN 1 ELSE 0 END)
 ON CONFLICT(user_id,day) DO UPDATE
 SET conversations=assistant_user_daily_budget.conversations+
   CASE WHEN p_kind='conversation' THEN 1 ELSE 0 END,
     turns=assistant_user_daily_budget.turns+
   CASE WHEN p_kind='turn' THEN 1 ELSE 0 END
 WHERE (p_kind='conversation' AND assistant_user_daily_budget.conversations<12)
    OR (p_kind='turn' AND assistant_user_daily_budget.turns<20);
 RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION app_private.ai_reserve_user_budget(text,text,text,text) FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_reserve_user_budget(text,text,text,text) TO menuminute_app;
