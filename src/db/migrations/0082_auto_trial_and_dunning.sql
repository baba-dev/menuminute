-- 0082: Automatic trial and payment-failure grace (docs/plans-and-limits.md).
-- Two owner-controlled features, both OFF by default:
--   * auto trial: the first time an organization owner publishes a menu, the organization receives a
--     one-time N-day Ordering trial (a normal entitlement grant, operator 'auto-trial');
--   * dunning grace: when the provider reports a failed renewal on a previously paid subscription, ordering
--     access continues for a few extra days (operator 'dunning-grace') while the provider retries.
-- Both are ordinary, time-boxed entitlement grants, so every existing gate keeps working unchanged.
-- A verified payment ends either window first (see record_razorpay_charge), and a stopped subscription
-- ends the grace (see record_razorpay_status). Forward-only; to disable, switch the settings off.

ALTER TABLE app_private.plan_settings
  ADD COLUMN auto_trial_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN auto_trial_days integer NOT NULL DEFAULT 14 CHECK (auto_trial_days BETWEEN 1 AND 90),
  ADD COLUMN dunning_grace_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN dunning_grace_days integer NOT NULL DEFAULT 5 CHECK (dunning_grace_days BETWEEN 1 AND 30);

-- One trial per organization AND per owner account, so extra workspaces cannot farm trials.
CREATE TABLE app_private.trial_claims (
  organization_id text PRIMARY KEY REFERENCES organizations(id) ON DELETE RESTRICT,
  owner_user_id text NOT NULL UNIQUE,
  outlet_id text NOT NULL,
  grant_id text NOT NULL UNIQUE REFERENCES entitlement_grants(id) ON DELETE RESTRICT,
  trial_days integer NOT NULL,
  claimed_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- One grace window per subscription billing cycle, however many failure events the provider sends.
CREATE TABLE app_private.dunning_graces (
  subscription_id text NOT NULL REFERENCES app_private.razorpay_subscriptions(subscription_id),
  cycle_end timestamptz NOT NULL,
  grant_id text NOT NULL UNIQUE REFERENCES entitlement_grants(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY (subscription_id, cycle_end)
);
REVOKE ALL ON app_private.trial_claims, app_private.dunning_graces
  FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Called inside the owner's publish transaction. It NEVER raises: any problem simply means no trial,
-- so publishing a menu can never fail because of this feature.
CREATE FUNCTION app_private.claim_auto_trial(p_outlet text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s app_private.plan_settings%ROWTYPE; r restaurants%ROWTYPE;
  actor text:=NULLIF(current_setting('app.actor_id',true),''); gid text:=gen_random_uuid()::text;
  v_end timestamptz;
BEGIN
  SELECT * INTO s FROM app_private.plan_settings WHERE singleton;
  IF NOT COALESCE(s.auto_trial_enabled,false) OR actor IS NULL THEN RETURN NULL; END IF;
  IF app_private.is_community_edition() THEN RETURN NULL; END IF;
  SELECT * INTO r FROM restaurants WHERE id=p_outlet AND is_active;
  IF NOT FOUND OR r.is_demo_data THEN RETURN NULL; END IF;
  -- Only the organization's owner, with a verified email, can start the trial.
  IF NOT EXISTS(SELECT 1 FROM organization_members m JOIN users u ON u.id=m.user_id
       WHERE m.organization_id=r.organization_id AND m.user_id=actor AND m.role='owner'
         AND m.is_active AND u.email_verified) THEN RETURN NULL; END IF;
  PERFORM 1 FROM organizations WHERE id=r.organization_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;
  -- Never for an organization that has ever had ordering access or a subscription of any kind.
  IF EXISTS(SELECT 1 FROM app_private.trial_claims c WHERE c.organization_id=r.organization_id OR c.owner_user_id=actor)
     OR EXISTS(SELECT 1 FROM entitlement_grants g WHERE g.organization_id=r.organization_id AND g.capability='ordering.new')
     OR EXISTS(SELECT 1 FROM app_private.razorpay_subscriptions x WHERE x.organization_id=r.organization_id)
  THEN RETURN NULL; END IF;
  v_end:=clock_timestamp()+make_interval(days=>s.auto_trial_days);
  INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
  VALUES(gid,r.organization_id,'ordering.new','INR',clock_timestamp(),v_end,'auto-trial',
    'Automatic '||s.auto_trial_days||'-day Ordering trial after first publish','auto-trial:'||r.organization_id);
  INSERT INTO app_private.trial_claims(organization_id,owner_user_id,outlet_id,grant_id,trial_days)
  VALUES(r.organization_id,actor,p_outlet,gid,s.auto_trial_days);
  RETURN jsonb_build_object('started',true,'endsAt',v_end,'days',s.auto_trial_days);
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app_private.claim_auto_trial(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.claim_auto_trial(text) TO menuminute_app;

-- Checkout is refused when an organization already holds a real paid or operator entitlement. An
-- automatic trial or a retry-grace window must NOT block paying, so they are excluded here.
CREATE FUNCTION app_private.entitlement_blocks_checkout(p_org text,p_capability text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT app_private.org_admin(p_org,true,true) AND EXISTS(
    SELECT 1 FROM entitlement_grants g
    WHERE g.organization_id=p_org AND g.capability=p_capability AND g.revoked_at IS NULL
      AND g.operator NOT IN ('auto-trial','dunning-grace')
      AND g.starts_at<=statement_timestamp() AND g.ends_at>statement_timestamp())
$$;
REVOKE ALL ON FUNCTION app_private.entitlement_blocks_checkout(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.entitlement_blocks_checkout(text,text) TO menuminute_app;

-- Internal: open the payment-retry grace for a previously paid ordering subscription.
CREATE FUNCTION app_private.start_dunning_grace(p_subscription text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE s app_private.plan_settings%ROWTYPE; sub app_private.razorpay_subscriptions%ROWTYPE;
  v_start timestamptz; v_end timestamptz; gid text:=gen_random_uuid()::text;
BEGIN
  SELECT * INTO s FROM app_private.plan_settings WHERE singleton;
  IF NOT COALESCE(s.dunning_grace_enabled,false) THEN RETURN; END IF;
  SELECT * INTO sub FROM app_private.razorpay_subscriptions WHERE subscription_id=p_subscription;
  -- Only a subscription that has been paid before, was not cancelled by the customer, and is for ordering.
  IF NOT FOUND OR sub.product_key<>'ordering' OR sub.current_end IS NULL
     OR sub.cancel_requested_at IS NOT NULL THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM app_private.dunning_graces d
            WHERE d.subscription_id=p_subscription AND d.cycle_end=sub.current_end) THEN RETURN; END IF;
  -- A future-dated grant would overlap the window; leave it alone.
  IF EXISTS(SELECT 1 FROM entitlement_grants e WHERE e.organization_id=sub.organization_id
     AND e.capability='ordering.new' AND e.revoked_at IS NULL AND e.starts_at>clock_timestamp()) THEN RETURN; END IF;
  -- Begin after any access that is still running, so the window never overlaps it.
  SELECT COALESCE(max(e.ends_at),clock_timestamp()) INTO v_start FROM entitlement_grants e
   WHERE e.organization_id=sub.organization_id AND e.capability='ordering.new'
     AND e.revoked_at IS NULL AND e.ends_at>clock_timestamp();
  v_end:=v_start+make_interval(days=>s.dunning_grace_days);
  INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
  VALUES(gid,sub.organization_id,'ordering.new','INR',v_start,v_end,'dunning-grace',
    'Payment retry grace for subscription '||p_subscription,gen_random_uuid()::text);
  INSERT INTO app_private.dunning_graces(subscription_id,cycle_end,grant_id) VALUES(p_subscription,sub.current_end,gid);
END $$;
REVOKE ALL ON FUNCTION app_private.start_dunning_grace(text) FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Billing-money functions: latest definitions (0037) with the trial/grace statements added.
CREATE OR REPLACE FUNCTION app_private.record_razorpay_charge(
  p_event text,p_subscription text,p_provider_plan text,p_payment text,
  p_start timestamptz,p_end timestamptz,p_provider_created timestamptz
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE sub app_private.razorpay_subscriptions%ROWTYPE;
        existing text; grant_id text:=gen_random_uuid()::text;
        cap text;
BEGIN
  IF length(p_event) NOT BETWEEN 8 AND 128 OR length(p_payment) NOT BETWEEN 8 AND 128
    OR p_start IS NULL OR p_end IS NULL OR p_end<=p_start
    OR p_end>p_start+interval '40 days' OR p_end<=clock_timestamp()
    OR p_provider_created IS NULL
  THEN RAISE EXCEPTION 'Invalid captured subscription charge' USING ERRCODE='22023'; END IF;
  SELECT * INTO sub FROM app_private.razorpay_subscriptions
    WHERE subscription_id=p_subscription FOR UPDATE;
  IF NOT FOUND OR sub.provider_plan_id<>p_provider_plan THEN
    RAISE EXCEPTION 'Subscription is not eligible' USING ERRCODE='42501';
  END IF;
  SELECT c.grant_id INTO existing FROM app_private.razorpay_charges c
    WHERE c.event_id=p_event OR c.payment_id=p_payment;
  IF FOUND THEN RETURN existing; END IF;
  IF sub.status IN ('cancelled','completed','expired','paused','halted') THEN
    RAISE EXCEPTION 'Subscription is not eligible' USING ERRCODE='42501';
  END IF;
  IF sub.last_provider_event_at IS NOT NULL AND p_provider_created<sub.last_provider_event_at THEN
    RAISE EXCEPTION 'Stale payment event' USING ERRCODE='22023';
  END IF;
  cap:=CASE sub.product_key WHEN 'ordering' THEN 'ordering.new' ELSE 'kitchen.new' END;
  -- Only an operator-approved global Kitchen release allows provider-paid grants.
  IF cap='kitchen.new' AND NOT app_private.kitchen_commerce_enabled() THEN
    RAISE EXCEPTION 'Kitchen Pro paid release has not been approved' USING ERRCODE='42501';
  END IF;
  PERFORM 1 FROM organizations WHERE id=sub.organization_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
  -- A verified payment supersedes an automatic trial or a payment-retry grace window. End them so the
  -- paid period starts cleanly; the overlap check below would otherwise reject a real payment.
  UPDATE entitlement_grants SET revoked_at=clock_timestamp()
   WHERE organization_id=sub.organization_id AND capability='ordering.new'
     AND operator IN ('auto-trial','dunning-grace') AND revoked_at IS NULL AND ends_at>clock_timestamp();
  IF EXISTS(SELECT 1 FROM entitlement_grants e WHERE e.organization_id=sub.organization_id
    AND e.capability=cap AND e.revoked_at IS NULL AND e.starts_at<p_end AND e.ends_at>p_start)
  THEN RAISE EXCEPTION 'Overlapping subscription grant' USING ERRCODE='23505'; END IF;
  INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
  VALUES(grant_id,sub.organization_id,cap,'INR',p_start,p_end,'razorpay-webhook',
    'Verified Razorpay subscription charge '||p_payment,gen_random_uuid()::text);
  INSERT INTO app_private.razorpay_charges(event_id,subscription_id,payment_id,grant_id)
    VALUES(p_event,p_subscription,p_payment,grant_id);
  UPDATE app_private.razorpay_subscriptions SET status='active',current_start=p_start,
    current_end=p_end,last_provider_event_at=p_provider_created,updated_at=clock_timestamp()
    WHERE subscription_id=p_subscription;
  IF cap='kitchen.new' THEN
    -- A paid Kitchen Pro package includes ordering intake; this grant is only
    -- minted from the *same verified charge*, not a guessed account plan.
    IF NOT EXISTS (
       SELECT 1 FROM entitlement_grants e WHERE e.organization_id=sub.organization_id
        AND e.capability='ordering.new' AND e.revoked_at IS NULL
        AND e.starts_at<=p_start AND e.ends_at>=p_end
    ) THEN
      INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,
        starts_at,ends_at,operator,reason,request_key)
      VALUES(gen_random_uuid()::text,sub.organization_id,'ordering.new','INR',p_start,p_end,
        'razorpay-webhook','Kitchen Pro bundled ordering via verified charge '||p_payment,
        gen_random_uuid()::text)
      RETURNING id INTO existing;
      INSERT INTO app_private.kitchen_paid_ordering_grants(kitchen_grant_id,ordering_grant_id)
        VALUES(grant_id,existing);
    END IF;
    -- Ready outlets begin routing now. Unconfigured outlets remain on the
    -- merchant board until their station wizard completes.
    PERFORM app_private.kitchen_auto_paid_activate(r.id)
      FROM restaurants r WHERE r.organization_id=sub.organization_id AND r.is_active;
  END IF;
  RETURN grant_id;
END $$;

CREATE OR REPLACE FUNCTION app_private.record_razorpay_status(
  p_event text,p_subscription text,p_status text,p_provider_created timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE sub app_private.razorpay_subscriptions%ROWTYPE;
        existing_grant_id text;
BEGIN
  IF p_status NOT IN ('pending','active','paused','halted','cancelled','completed','expired')
    OR length(p_event) NOT BETWEEN 8 AND 128 OR p_provider_created IS NULL
  THEN RAISE EXCEPTION 'Invalid provider status' USING ERRCODE='22023'; END IF;
  SELECT * INTO sub FROM app_private.razorpay_subscriptions
    WHERE subscription_id=p_subscription FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown provider subscription' USING ERRCODE='22023'; END IF;
  IF EXISTS(SELECT 1 FROM app_private.razorpay_status_events WHERE event_id=p_event) THEN RETURN; END IF;
  IF sub.last_provider_event_at IS NOT NULL AND p_provider_created<sub.last_provider_event_at THEN RETURN; END IF;
  INSERT INTO app_private.razorpay_status_events(event_id,subscription_id,status)
    VALUES(p_event,p_subscription,p_status);
  UPDATE app_private.razorpay_subscriptions SET status=p_status,
    last_provider_event_at=p_provider_created,updated_at=clock_timestamp()
    WHERE subscription_id=p_subscription;
  IF p_status IN ('paused','halted','expired') THEN
    UPDATE entitlement_grants SET revoked_at=clock_timestamp()
    WHERE id IN (
      SELECT c.grant_id FROM app_private.razorpay_charges c WHERE c.subscription_id=p_subscription
      UNION
      SELECT r.grant_id FROM app_private.razorpay_resume_grants r WHERE r.subscription_id=p_subscription
    ) AND revoked_at IS NULL AND ends_at>clock_timestamp();
    -- The subscription has stopped for good (or been paused): the retry grace ends with it.
    UPDATE entitlement_grants SET revoked_at=clock_timestamp()
     WHERE organization_id=sub.organization_id AND operator='dunning-grace'
       AND revoked_at IS NULL AND ends_at>clock_timestamp();
  ELSIF p_status='active' AND sub.current_end>clock_timestamp()
    AND EXISTS(
      SELECT 1 FROM app_private.razorpay_charges charge
      JOIN entitlement_grants paid ON paid.id=charge.grant_id
      WHERE charge.subscription_id=p_subscription AND paid.ends_at=sub.current_end
        AND NOT EXISTS(
          SELECT 1 FROM app_private.razorpay_refund_events refunded
          WHERE refunded.payment_id=charge.payment_id
        )
    )
    AND NOT EXISTS (
      SELECT 1 FROM entitlement_grants g WHERE g.revoked_at IS NULL
      AND g.organization_id=sub.organization_id
      AND g.capability=(CASE WHEN sub.product_key='ordering' THEN 'ordering.new' ELSE 'kitchen.new' END)
      AND g.ends_at>clock_timestamp()
    )
  THEN
    -- A signed resumption restores only the REMAINDER of a previously paid period.
    -- It never creates unpaid future access and does not depend on payment notes.
    INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
    VALUES(gen_random_uuid()::text,sub.organization_id,
      CASE WHEN sub.product_key='ordering' THEN 'ordering.new' ELSE 'kitchen.new' END,
      'INR',clock_timestamp(),sub.current_end,'razorpay-webhook',
      'Provider-resumed paid subscription '||p_subscription,gen_random_uuid()::text)
    RETURNING id INTO existing_grant_id;
    INSERT INTO app_private.razorpay_resume_grants(event_id,subscription_id,grant_id)
      VALUES(p_event,p_subscription,existing_grant_id);
    IF sub.product_key='kitchen_pro' AND app_private.kitchen_commerce_enabled() THEN
      IF NOT EXISTS (
        SELECT 1 FROM entitlement_grants e
        WHERE e.organization_id=sub.organization_id AND e.capability='ordering.new'
          AND e.revoked_at IS NULL
          AND e.starts_at<=clock_timestamp() AND e.ends_at>=sub.current_end
      ) THEN
        INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,
          starts_at,ends_at,operator,reason,request_key)
        VALUES(gen_random_uuid()::text,sub.organization_id,'ordering.new','INR',
          clock_timestamp(),sub.current_end,'razorpay-webhook',
          'Kitchen Pro bundled ordering restored for verified paid period',
          gen_random_uuid()::text)
        RETURNING id INTO existing_grant_id;
        INSERT INTO app_private.kitchen_paid_ordering_grants(kitchen_grant_id,ordering_grant_id)
        VALUES((SELECT grant_id FROM app_private.razorpay_resume_grants
          WHERE event_id=p_event),existing_grant_id);
      END IF;
    END IF;
  END IF;
  -- A recovered, fully paid Kitchen subscription can resume operation without
  -- staff asking the platform owner; readiness is still checked on each outlet.
  IF sub.product_key='kitchen_pro' AND p_status='active'
     AND app_private.kitchen_commerce_enabled() THEN
    PERFORM app_private.kitchen_auto_paid_activate(r.id)
      FROM restaurants r WHERE r.organization_id=sub.organization_id AND r.is_active;
  END IF;
  -- A failed renewal on an already-paid subscription opens a short grace window (if enabled).
  IF p_status='pending' THEN PERFORM app_private.start_dunning_grace(p_subscription); END IF;
  -- 'cancelled' and 'completed' retain already-paid access until the verified end.
END $$;

-- What the dashboard may show: an active trial (to anyone who can read the menu) and a payment problem
-- (to organization owners and admins only). NULL for callers who cannot read the outlet.
CREATE FUNCTION app_private.plan_lifecycle_snapshot(p_outlet text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT CASE WHEN app_private.can_outlet(p_outlet,'menu.read') THEN (
    SELECT jsonb_build_object(
      'trial',(SELECT jsonb_build_object('startedAt',g.starts_at,'endsAt',g.ends_at)
               FROM entitlement_grants g
               WHERE g.organization_id=r.organization_id AND g.capability='ordering.new'
                 AND g.operator='auto-trial' AND g.revoked_at IS NULL
                 AND g.starts_at<=statement_timestamp() AND g.ends_at>statement_timestamp()
               ORDER BY g.ends_at DESC LIMIT 1),
      'dunning',CASE WHEN app_private.org_admin(r.organization_id,false,true) THEN (
        SELECT jsonb_build_object('status',x.status,
          'graceUntil',(SELECT max(g.ends_at) FROM entitlement_grants g
                        WHERE g.organization_id=r.organization_id AND g.operator='dunning-grace'
                          AND g.revoked_at IS NULL AND g.ends_at>statement_timestamp()))
        FROM (SELECT s.status FROM app_private.razorpay_subscriptions s
              WHERE s.organization_id=r.organization_id AND s.product_key='ordering'
                AND s.current_end IS NOT NULL
              ORDER BY s.created_at DESC LIMIT 1) x
        WHERE x.status IN ('pending','halted','paused')
      ) END)
    FROM restaurants r WHERE r.id=p_outlet
  ) END
$$;
REVOKE ALL ON FUNCTION app_private.plan_lifecycle_snapshot(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.plan_lifecycle_snapshot(text) TO menuminute_app;
