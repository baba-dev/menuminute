-- #230 Ember: bounded per-model daily micro-USD reservations and exact-token settlement.
-- Fail closed before contacting a paid provider; do not imply a provider invoice or commercial approval.
ALTER TABLE assistant_attempts
  ADD COLUMN budget_day date,
  ADD COLUMN reserved_micro_usd bigint,
  ADD COLUMN billed_micro_usd bigint,
  ADD COLUMN input_price_micro_usd_mtok bigint,
  ADD COLUMN output_price_micro_usd_mtok bigint;
ALTER TABLE assistant_attempts ADD CONSTRAINT assistant_attempt_spend_shape CHECK (
  (budget_day IS NULL AND reserved_micro_usd IS NULL
    AND billed_micro_usd IS NULL AND input_price_micro_usd_mtok IS NULL
    AND output_price_micro_usd_mtok IS NULL)
  OR
  (budget_day IS NOT NULL AND reserved_micro_usd BETWEEN 1 AND 1000000000
    AND (billed_micro_usd IS NULL OR billed_micro_usd >= 0)
    AND input_price_micro_usd_mtok BETWEEN 1 AND 1000000000
    AND output_price_micro_usd_mtok BETWEEN 1 AND 1000000000)
);

CREATE TABLE assistant_model_daily_budget (
  organization_id text NOT NULL REFERENCES organizations(id),
  day date NOT NULL,
  provider text NOT NULL CHECK(provider IN ('nvidia','cloudflare')),
  model text NOT NULL CHECK(length(model) BETWEEN 1 AND 128),
  accounted_micro_usd bigint NOT NULL DEFAULT 0 CHECK(accounted_micro_usd >= 0),
  daily_cap_micro_usd bigint NOT NULL CHECK(daily_cap_micro_usd BETWEEN 1 AND 1000000000),
  PRIMARY KEY(organization_id,day,provider,model)
);
REVOKE ALL ON assistant_model_daily_budget FROM PUBLIC,menuminute_app,menuminute_worker;
-- No direct SELECT or UPDATE for the application; scoped functions only.

CREATE FUNCTION app_private.ai_reserve_model_spend(
  p_org text,p_outlet text,p_actor text,p_provider text,p_model text,
  p_reserve bigint,p_cap bigint
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT app_private.ai_scope(p_org,p_outlet,p_actor)
    OR p_provider NOT IN ('nvidia','cloudflare') OR length(p_model) NOT BETWEEN 1 AND 128
    OR p_reserve IS NULL OR p_cap IS NULL
    OR p_reserve NOT BETWEEN 1 AND 1000000000
    OR p_cap NOT BETWEEN 1 AND 1000000000 OR p_reserve > p_cap
  THEN RETURN false; END IF;
  INSERT INTO assistant_model_daily_budget
    (organization_id,day,provider,model,accounted_micro_usd,daily_cap_micro_usd)
  VALUES (p_org,(now() at time zone 'UTC')::date,p_provider,p_model,p_reserve,p_cap)
  ON CONFLICT(organization_id,day,provider,model) DO UPDATE
    SET accounted_micro_usd=assistant_model_daily_budget.accounted_micro_usd+EXCLUDED.accounted_micro_usd,
        daily_cap_micro_usd=LEAST(assistant_model_daily_budget.daily_cap_micro_usd,EXCLUDED.daily_cap_micro_usd)
    WHERE assistant_model_daily_budget.accounted_micro_usd + EXCLUDED.accounted_micro_usd
      <= LEAST(assistant_model_daily_budget.daily_cap_micro_usd,EXCLUDED.daily_cap_micro_usd);
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION app_private.ai_reserve_model_spend(text,text,text,text,text,bigint,bigint)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_reserve_model_spend(text,text,text,text,text,bigint,bigint)
  TO menuminute_app;

-- A settlement is unique (started->completed/uncertain), atomic with the private
-- budget adjustment, actor/outlet checked, and uses the immutable attempt price.
-- Missing usage or an uncertain provider response retains the full reservation.
CREATE FUNCTION app_private.ai_settle_model_spend(
  p_org text,p_outlet text,p_actor text,p_attempt text,
  p_succeeded boolean,p_input integer,p_output integer
) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE a assistant_attempts%ROWTYPE; actual_cost bigint;
BEGIN
  IF NOT app_private.ai_scope(p_org,p_outlet,p_actor) THEN RETURN false; END IF;
  SELECT * INTO a FROM assistant_attempts WHERE id=p_attempt
    AND organization_id=p_org AND outlet_id=p_outlet AND user_id=p_actor
    AND status='started' FOR UPDATE;
  IF NOT FOUND OR a.budget_day IS NULL THEN RETURN false; END IF;
  IF p_succeeded AND p_input IS NOT NULL AND p_output IS NOT NULL
     AND p_input >= 0 AND p_output >= 0 THEN
    actual_cost := CEIL(
      (p_input::numeric*a.input_price_micro_usd_mtok
      +p_output::numeric*a.output_price_micro_usd_mtok)/1000000
    )::bigint;
  ELSE
    actual_cost := a.reserved_micro_usd;
  END IF;
  UPDATE assistant_model_daily_budget
     SET accounted_micro_usd=accounted_micro_usd-a.reserved_micro_usd+actual_cost
   WHERE organization_id=p_org AND day=a.budget_day
     AND provider=a.provider AND model=a.model;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing private model budget' USING ERRCODE='23514'; END IF;
  UPDATE assistant_attempts SET
    status=CASE WHEN p_succeeded THEN 'completed' ELSE 'uncertain' END,
    input_tokens=CASE WHEN p_succeeded THEN p_input ELSE NULL END,
    output_tokens=CASE WHEN p_succeeded THEN p_output ELSE NULL END,
    billed_micro_usd=CASE WHEN p_succeeded AND p_input IS NOT NULL
      AND p_output IS NOT NULL AND p_input>=0 AND p_output>=0 THEN actual_cost ELSE NULL END,
    settled_at=now() WHERE id=p_attempt;
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION app_private.ai_settle_model_spend(text,text,text,text,boolean,integer,integer)
  FROM PUBLIC,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.ai_settle_model_spend(text,text,text,text,boolean,integer,integer)
  TO menuminute_app;
