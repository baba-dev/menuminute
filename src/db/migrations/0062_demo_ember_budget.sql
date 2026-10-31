-- The public demo shares ONE account, so the per-user daily Ember limits (12 conversations, 20 turns)
-- and the per-organization limit (80 attempts) would be exhausted by a handful of visitors and then
-- block everyone until UTC midnight. Raise them for exactly the fixed demo actor/organization; every
-- other tenant keeps the original limits. The demo's real cost ceiling is enforced in the application
-- (per-source and daily turn caps, DEMO_AI_DAILY_TURNS) plus the shared provider daily spend cap.
-- Forward-only: both functions are replaced by supersets of their 0021 behaviour.
CREATE OR REPLACE FUNCTION app_private.ai_reserve_user_budget(p_org text, p_outlet text, p_actor text, p_kind text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE
  demo boolean := p_actor='demo-owner' AND p_org='org-demo-outlet';
  conv_limit integer;
  turn_limit integer;
BEGIN
 IF NOT app_private.ai_scope(p_org,p_outlet,p_actor) OR p_kind NOT IN ('conversation','turn') THEN RETURN false; END IF;
 conv_limit:=CASE WHEN demo THEN 60 ELSE 12 END;
 turn_limit:=CASE WHEN demo THEN 400 ELSE 20 END;
 INSERT INTO assistant_user_daily_budget(user_id,day,conversations,turns)
 VALUES(p_actor,(now() at time zone 'UTC')::date,
        CASE WHEN p_kind='conversation' THEN 1 ELSE 0 END,
        CASE WHEN p_kind='turn' THEN 1 ELSE 0 END)
 ON CONFLICT(user_id,day) DO UPDATE
 SET conversations=assistant_user_daily_budget.conversations+
   CASE WHEN p_kind='conversation' THEN 1 ELSE 0 END,
     turns=assistant_user_daily_budget.turns+
   CASE WHEN p_kind='turn' THEN 1 ELSE 0 END
 WHERE (p_kind='conversation' AND assistant_user_daily_budget.conversations<conv_limit)
    OR (p_kind='turn' AND assistant_user_daily_budget.turns<turn_limit);
 RETURN FOUND;
END $$;

CREATE OR REPLACE FUNCTION app_private.ai_reserve_org_budget(p_org text, p_outlet text, p_actor text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE attempt_limit integer;
BEGIN
 IF NOT app_private.ai_scope(p_org,p_outlet,p_actor) THEN RETURN false; END IF;
 attempt_limit:=CASE WHEN p_org='org-demo-outlet' AND p_actor='demo-owner' THEN 800 ELSE 80 END;
 INSERT INTO assistant_org_daily_budget(organization_id,day,attempts)
 VALUES(p_org,(now() at time zone 'UTC')::date,1)
 ON CONFLICT(organization_id,day) DO UPDATE SET attempts=assistant_org_daily_budget.attempts+1
 WHERE assistant_org_daily_budget.attempts < attempt_limit;
 RETURN FOUND;
END $$;

-- The table checks repeat the original ceilings; widen them only for the fixed demo actor/organization.
ALTER TABLE assistant_user_daily_budget
  DROP CONSTRAINT assistant_user_daily_budget_conversations_check,
  DROP CONSTRAINT assistant_user_daily_budget_turns_check,
  ADD CONSTRAINT assistant_user_daily_budget_conversations_check
    CHECK (conversations >= 0 AND (conversations <= 12 OR (user_id = 'demo-owner' AND conversations <= 60))),
  ADD CONSTRAINT assistant_user_daily_budget_turns_check
    CHECK (turns >= 0 AND (turns <= 20 OR (user_id = 'demo-owner' AND turns <= 400)));
ALTER TABLE assistant_org_daily_budget
  DROP CONSTRAINT assistant_org_daily_budget_attempts_check,
  ADD CONSTRAINT assistant_org_daily_budget_attempts_check
    CHECK (attempts >= 0 AND (attempts <= 80 OR (organization_id = 'org-demo-outlet' AND attempts <= 800)));
