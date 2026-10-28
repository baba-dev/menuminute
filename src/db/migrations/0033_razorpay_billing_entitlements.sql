-- 0033: Subscription records and restricted provider-authorized entitlement writing.
-- This migration requires the separately provisioned NOINHERIT menuminute_billing role.
-- The ordinary web role may register a checkout, but CANNOT mint or revoke paid grants.

CREATE TABLE app_private.deployment_edition (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  edition text NOT NULL DEFAULT 'cloud' CHECK (edition IN ('cloud','community'))
);
INSERT INTO app_private.deployment_edition(singleton,edition) VALUES(true,'cloud');
REVOKE ALL ON app_private.deployment_edition FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.is_community_edition() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT edition='community' FROM app_private.deployment_edition WHERE singleton
$$;
REVOKE ALL ON FUNCTION app_private.is_community_edition() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.is_community_edition() TO menuminute_app;

-- The single-user invariant belongs to the database, not a non-atomic sign-up hook.
CREATE FUNCTION app_private.community_single_user() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  PERFORM 1 FROM app_private.deployment_edition WHERE singleton FOR UPDATE;
  IF app_private.is_community_edition() AND EXISTS(SELECT 1 FROM users) THEN
    RAISE EXCEPTION 'Community Edition permits one account' USING ERRCODE='23505';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.community_single_user() FROM PUBLIC;
CREATE TRIGGER community_single_user BEFORE INSERT ON users
FOR EACH ROW EXECUTE FUNCTION app_private.community_single_user();

-- Provisioning grants are owner-created and never derived from an HTTP parameter.
-- Existing organizations are backfilled when an owner explicitly switches edition.
CREATE FUNCTION app_private.community_organization_grants() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF app_private.is_community_edition() THEN
    INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key)
    SELECT gen_random_uuid()::text,NEW.id,c,'INR',clock_timestamp(),'infinity'::timestamptz,
           'community-edition','Locally hosted Community Edition',gen_random_uuid()::text
    FROM unnest(ARRAY['ordering.new','kitchen.new']) AS c;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION app_private.community_organization_grants() FROM PUBLIC;
CREATE TRIGGER community_organization_entitlements AFTER INSERT ON organizations
FOR EACH ROW EXECUTE FUNCTION app_private.community_organization_grants();

CREATE TABLE app_private.razorpay_subscriptions (
  subscription_id text PRIMARY KEY,
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  product_key text NOT NULL CHECK(product_key IN ('ordering','kitchen_pro')),
  provider_plan_id text NOT NULL,
  status text NOT NULL DEFAULT 'created' CHECK(status IN ('created','authenticated','active','pending','paused','halted','cancelled','completed','expired')),
  last_provider_event_at timestamptz,
  current_start timestamptz,
  current_end timestamptz,
  created_by text NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  cancel_requested_at timestamptz
);
CREATE INDEX razorpay_subscriptions_org_idx ON app_private.razorpay_subscriptions(organization_id,created_at DESC);
REVOKE ALL ON app_private.razorpay_subscriptions FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE TABLE app_private.razorpay_charges (
  event_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES app_private.razorpay_subscriptions(subscription_id),
  payment_id text NOT NULL UNIQUE,
  grant_id text NOT NULL UNIQUE REFERENCES entitlement_grants(id),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE app_private.razorpay_status_events (
  event_id text PRIMARY KEY,
  subscription_id text NOT NULL REFERENCES app_private.razorpay_subscriptions(subscription_id),
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON app_private.razorpay_charges,app_private.razorpay_status_events
  FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE FUNCTION app_private.register_razorpay_subscription(
  p_subscription text,p_org text,p_product text,p_provider_plan text
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v app_private.razorpay_subscriptions%ROWTYPE;
BEGIN
  IF NOT app_private.org_admin(p_org,true,false) OR
     p_product NOT IN ('ordering','kitchen_pro') OR
     length(p_subscription) NOT BETWEEN 8 AND 128 OR length(p_provider_plan) NOT BETWEEN 8 AND 128
  THEN RAISE EXCEPTION 'Invalid checkout authorization' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM app_private.razorpay_subscriptions WHERE subscription_id=p_subscription FOR UPDATE;
  IF FOUND THEN
    IF v.organization_id<>p_org OR v.product_key<>p_product OR v.provider_plan_id<>p_provider_plan THEN
      RAISE EXCEPTION 'Subscription identifier is already bound' USING ERRCODE='23505';
    END IF;
    RETURN v.subscription_id;
  END IF;
  INSERT INTO app_private.razorpay_subscriptions(subscription_id,organization_id,product_key,provider_plan_id,created_by)
  VALUES(p_subscription,p_org,p_product,p_provider_plan,
    NULLIF(current_setting('app.actor_id',true),''));
  RETURN p_subscription;
END $$;
REVOKE ALL ON FUNCTION app_private.register_razorpay_subscription(text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.register_razorpay_subscription(text,text,text,text) TO menuminute_app;

CREATE FUNCTION app_private.razorpay_subscription_state(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT app_private.org_admin(p_org,true,true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('subscriptionId',subscription_id,'product',product_key,
      'status',status,'currentPeriodEnd',current_end,'createdAt',created_at,
      'cancelRequestedAt',cancel_requested_at)
      ORDER BY created_at DESC)
    FROM app_private.razorpay_subscriptions WHERE organization_id=p_org
  ),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.razorpay_subscription_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.razorpay_subscription_state(text) TO menuminute_app;

-- Owner-only local acknowledgement, permitted only AFTER provider cancellation succeeds.
-- It never changes an entitlement or pretends that a payment was reversed.
CREATE FUNCTION app_private.mark_razorpay_cancel_requested(p_org text,p_subscription text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $
BEGIN
  IF NOT app_private.org_admin(p_org,true,false) THEN
    RAISE EXCEPTION 'Owner authorization required' USING ERRCODE='42501';
  END IF;
  UPDATE app_private.razorpay_subscriptions SET cancel_requested_at=clock_timestamp(),
    updated_at=clock_timestamp()
    WHERE subscription_id=p_subscription AND organization_id=p_org
      AND status IN ('active','authenticated','pending','created');
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not cancellable' USING ERRCODE='22023'; END IF;
END $;
REVOKE ALL ON FUNCTION app_private.mark_razorpay_cancel_requested(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.mark_razorpay_cancel_requested(text,text) TO menuminute_app;

-- Only the dedicated webhook database identity can execute this primitive.
-- Verify provider signatures before connecting to menuminute_billing. No
-- organization, capability or entitlement window is trusted from payment notes.
CREATE FUNCTION app_private.record_razorpay_charge(
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
  IF NOT FOUND OR sub.provider_plan_id<>p_provider_plan OR
     sub.status IN ('cancelled','completed','expired','paused','halted') THEN
    RAISE EXCEPTION 'Subscription is not eligible' USING ERRCODE='42501';
  END IF;
  SELECT c.grant_id INTO existing FROM app_private.razorpay_charges c
    WHERE c.event_id=p_event OR c.payment_id=p_payment;
  IF FOUND THEN RETURN existing; END IF;
  IF sub.last_provider_event_at IS NOT NULL AND p_provider_created<sub.last_provider_event_at THEN
    RAISE EXCEPTION 'Stale payment event' USING ERRCODE='22023';
  END IF;
  cap:=CASE sub.product_key WHEN 'ordering' THEN 'ordering.new' ELSE 'kitchen.new' END;
  -- Existing Kitchen Pro pilot controls are NOT a commercial release authorization.
  IF cap='kitchen.new' THEN RAISE EXCEPTION 'Kitchen Pro commercial activation is not approved'
    USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM organizations WHERE id=sub.organization_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
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
  RETURN grant_id;
END $$;
REVOKE ALL ON FUNCTION app_private.record_razorpay_charge(text,text,text,text,timestamptz,timestamptz,timestamptz)
  FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT USAGE ON SCHEMA app_private TO menuminute_billing;
GRANT EXECUTE ON FUNCTION app_private.record_razorpay_charge(text,text,text,text,timestamptz,timestamptz,timestamptz)
  TO menuminute_billing;

CREATE FUNCTION app_private.record_razorpay_status(
  p_event text,p_subscription text,p_status text,p_provider_created timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE sub app_private.razorpay_subscriptions%ROWTYPE;
BEGIN
  IF p_status NOT IN ('paused','halted','cancelled','completed','expired')
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
    WHERE id IN (SELECT c.grant_id FROM app_private.razorpay_charges c WHERE c.subscription_id=p_subscription)
      AND revoked_at IS NULL AND ends_at>clock_timestamp();
  END IF;
  -- 'cancelled' and 'completed' retain already-paid access until the verified end.
END $$;
REVOKE ALL ON FUNCTION app_private.record_razorpay_status(text,text,text,timestamptz)
  FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.record_razorpay_status(text,text,text,timestamptz)
  TO menuminute_billing;

-- Seed amounts in INR minor units. Kitchen remains commercially inactive until
-- the separate Kitchen Pro production approval and database activation migration.
INSERT INTO subscription_plans(id,name,display_name,monthly_price_paise,features,is_active,sort_order)
VALUES
 ('plan_free','free','Free Forever',0,'["qr_menu","unlimited_dishes","ai_paper_scan","sold_out_86"]',true,1),
 ('plan_ordering','ordering','Live Table Ordering',11900,'["table_ordering","cart_checkout","service_counter","order_tracking"]',true,2),
 ('plan_kitchen_pro','kitchen_pro','Kitchen Pro KDS',29900,'["live_kds","audio_chimes","station_routing","pos_till"]',false,3)
ON CONFLICT(id) DO UPDATE SET
 display_name=EXCLUDED.display_name,monthly_price_paise=EXCLUDED.monthly_price_paise,
 features=EXCLUDED.features,is_active=EXCLUDED.is_active,sort_order=EXCLUDED.sort_order;
