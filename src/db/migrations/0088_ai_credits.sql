-- 0088: Monthly AI credits per organization (docs/plans-and-limits.md).
-- A credit is one merchant-initiated AI request (an assistant message, a dish autofill, or one page of an
-- AI menu import). The allowance is pooled across the organization's outlets and resets at the start of each
-- UTC month with no rollover. The cap is passed in by the application from the reviewed plan catalog (the
-- same pattern as the media budget); the ledger itself is private: no application role can read or write it
-- except through these three checked functions. Credits are only counted while plan limits are enforced.
-- Forward-only.

CREATE TABLE app_private.ai_credit_usage (
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  month date NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used >= 0),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (organization_id, month)
);
REVOKE ALL ON app_private.ai_credit_usage FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Atomically spends p_cost credits against p_cap (NULL = uncapped, still recorded for the meter).
-- Returns {allowed, used, cap, resetsAt}. A refusal changes nothing.
CREATE FUNCTION app_private.ai_credit_spend(p_outlet text,p_cost integer,p_cap integer) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org text; m date:=(date_trunc('month',now() AT TIME ZONE 'UTC'))::date; u integer;
BEGIN
  IF p_cost IS NULL OR p_cost NOT BETWEEN 1 AND 500 OR (p_cap IS NOT NULL AND p_cap<0) THEN
    RAISE EXCEPTION 'Invalid AI credit request' USING ERRCODE='22023';
  END IF;
  IF NOT app_private.can_outlet(p_outlet,'menu.read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
  IF org IS NULL THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ai-credit:'||org,0));
  INSERT INTO app_private.ai_credit_usage(organization_id,month) VALUES(org,m) ON CONFLICT DO NOTHING;
  SELECT used INTO u FROM app_private.ai_credit_usage WHERE organization_id=org AND month=m FOR UPDATE;
  IF p_cap IS NOT NULL AND u+p_cost>p_cap THEN
    RETURN jsonb_build_object('allowed',false,'used',u,'cap',p_cap,'resetsAt',(m+interval '1 month'));
  END IF;
  UPDATE app_private.ai_credit_usage SET used=used+p_cost,updated_at=clock_timestamp()
   WHERE organization_id=org AND month=m;
  RETURN jsonb_build_object('allowed',true,'used',u+p_cost,'cap',p_cap,'resetsAt',(m+interval '1 month'));
END $$;
REVOKE ALL ON FUNCTION app_private.ai_credit_spend(text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.ai_credit_spend(text,integer,integer) TO menuminute_app;

-- Gives credits back when the request produced nothing (the provider failed). Never goes below zero.
CREATE FUNCTION app_private.ai_credit_refund(p_outlet text,p_cost integer) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE org text; m date:=(date_trunc('month',now() AT TIME ZONE 'UTC'))::date;
BEGIN
  IF p_cost IS NULL OR p_cost NOT BETWEEN 1 AND 500 THEN
    RAISE EXCEPTION 'Invalid AI credit request' USING ERRCODE='22023';
  END IF;
  IF NOT app_private.can_outlet(p_outlet,'menu.read') THEN RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501'; END IF;
  SELECT organization_id INTO org FROM restaurants WHERE id=p_outlet;
  IF org IS NULL THEN RETURN; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('ai-credit:'||org,0));
  UPDATE app_private.ai_credit_usage SET used=greatest(0,used-p_cost),updated_at=clock_timestamp()
   WHERE organization_id=org AND month=m;
END $$;
REVOKE ALL ON FUNCTION app_private.ai_credit_refund(text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.ai_credit_refund(text,integer) TO menuminute_app;

-- Read-only: this month's usage and when it resets, for the usage meter. NULL if the caller cannot read the outlet.
CREATE FUNCTION app_private.ai_credit_snapshot(p_outlet text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT CASE WHEN app_private.can_outlet(p_outlet,'menu.read') THEN (
    SELECT jsonb_build_object(
      'used',COALESCE((SELECT u.used FROM app_private.ai_credit_usage u
                        WHERE u.organization_id=r.organization_id
                          AND u.month=(date_trunc('month',now() AT TIME ZONE 'UTC'))::date),0),
      'resetsAt',((date_trunc('month',now() AT TIME ZONE 'UTC'))::date+interval '1 month'))
    FROM restaurants r WHERE r.id=p_outlet) END
$$;
REVOKE ALL ON FUNCTION app_private.ai_credit_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.ai_credit_snapshot(text) TO menuminute_app;

-- Read-only: bytes of photos an outlet stores, counted exactly as the upload budget counts them (every photo
-- record), for the storage meter. dish_media is only readable by menu editors, so viewers use this instead.
CREATE FUNCTION app_private.media_usage_bytes(p_outlet text) RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT CASE WHEN app_private.can_outlet(p_outlet,'menu.read')
    THEN COALESCE((SELECT sum(size_bytes) FROM dish_media WHERE outlet_id=p_outlet),0)::bigint END
$$;
REVOKE ALL ON FUNCTION app_private.media_usage_bytes(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.media_usage_bytes(text) TO menuminute_app;
