-- 0087: Reminder emails for the plan lifecycle (trial ending, payment failing, grace period ending).
-- A durable, idempotent queue: the worker asks the database which reminders are due, the database records
-- each one exactly once per recipient and event (unique kind + event + recipient), and the worker sends
-- them. Delivery is at-least-once with a bounded retry; a failed send never blocks billing or ordering.
-- Recipients are active organization owners (trial) or owners and admins (payment problems) with a
-- verified email address. Demo accounts and inactive organizations never receive mail. Forward-only.

CREATE TABLE app_private.plan_email_notices (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  kind text NOT NULL CHECK (kind IN ('trial_ending','payment_failed','grace_ending')),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- The entitlement grant the reminder is about (the trial or the grace window).
  grant_id text NOT NULL REFERENCES entitlement_grants(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','abandoned')),
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  sent_at timestamptz,
  UNIQUE (kind, grant_id, user_id)
);
CREATE INDEX plan_email_notices_due ON app_private.plan_email_notices (next_attempt_at) WHERE status='pending';
REVOKE ALL ON app_private.plan_email_notices FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Records the reminders that are due now. Returns how many new ones were recorded.
--   trial_ending   : an active automatic trial that ends within 3 days            -> organization owners
--   payment_failed : a payment-retry grace window opened within the last 3 days   -> owners and admins
--   grace_ending   : a payment-retry grace window that ends within 1 day          -> owners and admins
CREATE FUNCTION app_private.enqueue_plan_email_notices() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE n integer:=0; c integer;
BEGIN
  INSERT INTO app_private.plan_email_notices(kind,organization_id,user_id,grant_id)
  SELECT 'trial_ending',g.organization_id,m.user_id,g.id
    FROM entitlement_grants g
    JOIN organizations o ON o.id=g.organization_id AND o.is_active
    JOIN organization_members m ON m.organization_id=g.organization_id AND m.is_active AND m.role='owner'
    JOIN users u ON u.id=m.user_id AND u.email_verified AND NOT u.is_demo_data
   WHERE g.operator='auto-trial' AND g.capability='ordering.new' AND g.revoked_at IS NULL
     AND g.ends_at>clock_timestamp() AND g.ends_at<=clock_timestamp()+interval '3 days'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS c=ROW_COUNT; n:=n+c;

  INSERT INTO app_private.plan_email_notices(kind,organization_id,user_id,grant_id)
  SELECT 'payment_failed',g.organization_id,m.user_id,g.id
    FROM app_private.dunning_graces d
    JOIN entitlement_grants g ON g.id=d.grant_id AND g.revoked_at IS NULL AND g.ends_at>clock_timestamp()
    JOIN organizations o ON o.id=g.organization_id AND o.is_active
    JOIN organization_members m ON m.organization_id=g.organization_id AND m.is_active AND m.role IN ('owner','admin')
    JOIN users u ON u.id=m.user_id AND u.email_verified AND NOT u.is_demo_data
   WHERE d.created_at>clock_timestamp()-interval '3 days'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS c=ROW_COUNT; n:=n+c;

  INSERT INTO app_private.plan_email_notices(kind,organization_id,user_id,grant_id)
  SELECT 'grace_ending',g.organization_id,m.user_id,g.id
    FROM entitlement_grants g
    JOIN organizations o ON o.id=g.organization_id AND o.is_active
    JOIN organization_members m ON m.organization_id=g.organization_id AND m.is_active AND m.role IN ('owner','admin')
    JOIN users u ON u.id=m.user_id AND u.email_verified AND NOT u.is_demo_data
   WHERE g.operator='dunning-grace' AND g.capability='ordering.new' AND g.revoked_at IS NULL
     AND g.ends_at>clock_timestamp() AND g.ends_at<=clock_timestamp()+interval '1 day'
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS c=ROW_COUNT; n:=n+c;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION app_private.enqueue_plan_email_notices() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.enqueue_plan_email_notices() TO menuminute_worker;

-- Hands the worker the next reminders to send and leases them for 15 minutes, so two workers never send
-- the same one and a crash is retried. A reminder whose situation has ended (the customer paid, the trial
-- was replaced, the window passed) is dropped instead of sent. Gives up after 5 attempts.
CREATE FUNCTION app_private.claim_plan_email_notices(p_limit integer) RETURNS TABLE(
  id text,kind text,to_email text,to_name text,organization_name text,ends_at timestamptz
) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF p_limit IS NULL OR p_limit NOT BETWEEN 1 AND 100 THEN
    RAISE EXCEPTION 'Invalid batch size' USING ERRCODE='22023';
  END IF;
  -- Drop what no longer applies.
  UPDATE app_private.plan_email_notices x SET status='abandoned'
   WHERE x.status='pending' AND NOT EXISTS(
     SELECT 1 FROM entitlement_grants g WHERE g.id=x.grant_id AND g.revoked_at IS NULL AND g.ends_at>clock_timestamp());
  RETURN QUERY
  WITH due AS (
    SELECT x.id FROM app_private.plan_email_notices x
     WHERE x.status='pending' AND x.next_attempt_at<=clock_timestamp()
     ORDER BY x.next_attempt_at LIMIT p_limit FOR UPDATE SKIP LOCKED
  ), leased AS (
    UPDATE app_private.plan_email_notices x
       SET attempts=x.attempts+1,next_attempt_at=clock_timestamp()+interval '15 minutes',
           status=CASE WHEN x.attempts+1>=5 THEN 'abandoned' ELSE x.status END
      FROM due WHERE x.id=due.id
    RETURNING x.id,x.kind,x.user_id,x.organization_id,x.grant_id
  )
  SELECT l.id,l.kind,u.email,u.name,o.name,g.ends_at
    FROM leased l
    JOIN users u ON u.id=l.user_id
    JOIN organizations o ON o.id=l.organization_id
    JOIN entitlement_grants g ON g.id=l.grant_id;
END $$;
REVOKE ALL ON FUNCTION app_private.claim_plan_email_notices(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.claim_plan_email_notices(integer) TO menuminute_worker;

-- The worker reports success. A failure needs no call: the lease simply expires and the reminder retries.
CREATE FUNCTION app_private.complete_plan_email_notice(p_id text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  UPDATE app_private.plan_email_notices SET status='sent',sent_at=clock_timestamp()
   WHERE id=p_id AND status IN ('pending','abandoned') AND sent_at IS NULL
$$;
REVOKE ALL ON FUNCTION app_private.complete_plan_email_notice(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.complete_plan_email_notice(text) TO menuminute_worker;
