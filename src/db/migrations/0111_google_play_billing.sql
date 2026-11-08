-- 0111: Google Play Billing (Play-distributed Android app, Digital Goods API / TWA).
--  * Play is a second payment PROVIDER for the same entitlement_grants source of truth. Nothing here
--    grants a feature from a client callback: the application re-queries the Google Play Developer API
--    (purchases.subscriptionsv2.get) and only then calls the restricted billing-role function below.
--  * The ordinary web role may only REGISTER a purchase token against an organization it owns.
--    Only menuminute_billing can turn verified Play state into (or out of) an entitlement grant.
--  * Products: Ordering and Kitchen Pro. Kitchen Pro mirrors the Razorpay semantics exactly: it is gated
--    by the platform Kitchen release switch, mints the bundled Ordering grant from the SAME verified
--    purchase, revokes that bundle with the Kitchen grant, and activates ready outlets. Buying Kitchen Pro
--    in Play stops the organization's Play Ordering subscription from renewing (paid days stay active).
--  * One provider per organization: Play checkout is refused while Razorpay is billing, and vice versa.
-- Forward-only.

CREATE TABLE app_private.play_purchases (
  purchase_token text PRIMARY KEY CHECK (length(purchase_token) BETWEEN 16 AND 4096),
  organization_id text NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  product_key text NOT NULL CHECK (product_key IN ('ordering','kitchen_pro')),
  play_product_id text,
  base_plan_id text,
  state text NOT NULL DEFAULT 'registered' CHECK (state IN (
    'registered','pending','active','canceled','grace','on_hold','paused','expired','revoked','replaced','conflict')),
  expiry_time timestamptz,
  auto_renewing boolean NOT NULL DEFAULT false,
  latest_order_id text,
  linked_purchase_token text,
  test_purchase boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz,
  active_grant_id text REFERENCES entitlement_grants(id),
  billing_currency text NOT NULL DEFAULT 'INR' CHECK (billing_currency IN ('INR','USD')),
  created_by text NOT NULL REFERENCES users(id),
  last_verified_at timestamptz,
  superseded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX play_purchases_org_idx ON app_private.play_purchases(organization_id, created_at DESC);
CREATE INDEX play_purchases_linked_idx ON app_private.play_purchases(linked_purchase_token)
  WHERE linked_purchase_token IS NOT NULL;
REVOKE ALL ON app_private.play_purchases FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Idempotency + audit for Real-time Developer Notifications (Pub/Sub messageId) and verifications.
CREATE TABLE app_private.play_events (
  event_id text PRIMARY KEY CHECK (length(event_id) BETWEEN 8 AND 256),
  purchase_token text REFERENCES app_private.play_purchases(purchase_token),
  kind text NOT NULL,
  resulting_state text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON app_private.play_events FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

-- Web role: bind a purchase token to an organization the caller OWNS. The token is a bearer secret known
-- only to the purchaser; binding does not grant anything. A token can never be re-bound elsewhere.
CREATE FUNCTION app_private.register_play_purchase(p_token text,p_org text,p_product text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE v app_private.play_purchases%ROWTYPE;
BEGIN
  IF NOT app_private.org_admin(p_org,true,false) OR p_product NOT IN ('ordering','kitchen_pro')
     OR length(p_token) NOT BETWEEN 16 AND 4096
  THEN RAISE EXCEPTION 'Invalid purchase authorization' USING ERRCODE='42501'; END IF;
  PERFORM 1 FROM organizations WHERE id=p_org AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Organization unavailable' USING ERRCODE='42501'; END IF;
  SELECT * INTO v FROM app_private.play_purchases WHERE purchase_token=p_token FOR UPDATE;
  IF FOUND THEN
    IF v.organization_id<>p_org OR v.product_key<>p_product THEN
      RAISE EXCEPTION 'Purchase is already bound' USING ERRCODE='23505';
    END IF;
    RETURN v.state;
  END IF;
  INSERT INTO app_private.play_purchases(purchase_token,organization_id,product_key,created_by)
  VALUES(p_token,p_org,p_product,NULLIF(current_setting('app.actor_id',true),''));
  RETURN 'registered';
END $$;
REVOKE ALL ON FUNCTION app_private.register_play_purchase(text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.register_play_purchase(text,text,text) TO menuminute_app;

-- Web role: refuse a purchase when another provider or an overlapping entitlement already exists.
-- Returns NULL when checkout may proceed, otherwise the blocker:
--   'razorpay' | 'play' | 'entitlement' | 'kitchen_unavailable'.
-- A live Play ORDERING subscription does not block a Kitchen Pro purchase (that is the upgrade path).
CREATE FUNCTION app_private.play_checkout_blocker(p_org text,p_product text) RETURNS text
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE cap text:=CASE p_product WHEN 'kitchen_pro' THEN 'kitchen.new' ELSE 'ordering.new' END;
BEGIN
  IF NOT app_private.org_admin(p_org,true,true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  IF p_product NOT IN ('ordering','kitchen_pro') THEN
    RAISE EXCEPTION 'Invalid product' USING ERRCODE='22023';
  END IF;
  IF p_product='kitchen_pro' AND NOT app_private.kitchen_commerce_enabled()
  THEN RETURN 'kitchen_unavailable'; END IF;
  IF EXISTS(SELECT 1 FROM app_private.razorpay_subscriptions s WHERE s.organization_id=p_org
      AND s.status IN ('authenticated','active','pending') AND s.cancel_requested_at IS NULL)
  THEN RETURN 'razorpay'; END IF;
  IF EXISTS(SELECT 1 FROM app_private.play_purchases p WHERE p.organization_id=p_org
      AND (p_product='ordering' OR p.product_key='kitchen_pro')
      AND ((p.state IN ('active','grace','on_hold','paused','pending') AND (p.expiry_time IS NULL OR p.expiry_time>clock_timestamp()))
        OR (p.state='canceled' AND p.expiry_time>clock_timestamp())))
  THEN RETURN 'play'; END IF;
  -- Kitchen Pro may be bought over an Ordering entitlement; only a live Kitchen entitlement blocks it.
  IF app_private.entitlement_blocks_checkout(p_org,cap) THEN RETURN 'entitlement'; END IF;
  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION app_private.play_checkout_blocker(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.play_checkout_blocker(text,text) TO menuminute_app;

-- Web role: Razorpay checkout must also refuse while Play is billing (the reverse guard).
CREATE FUNCTION app_private.play_subscription_blocks_razorpay(p_org text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT app_private.org_admin(p_org,true,true) AND EXISTS(
    SELECT 1 FROM app_private.play_purchases p WHERE p.organization_id=p_org
      AND p.state IN ('active','canceled','grace','on_hold','paused')
      AND p.expiry_time>clock_timestamp())
$$;
REVOKE ALL ON FUNCTION app_private.play_subscription_blocks_razorpay(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.play_subscription_blocks_razorpay(text) TO menuminute_app;

-- Web role: owner-readable summary for the Billing page. Never returns the purchase token.
CREATE FUNCTION app_private.play_subscription_state(p_org text) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF NOT app_private.org_admin(p_org,true,true) THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE='42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object('product',product_key,'state',state,
      'currentPeriodEnd',expiry_time,'autoRenewing',auto_renewing,'createdAt',created_at,
      'testPurchase',test_purchase) ORDER BY created_at DESC)
    FROM app_private.play_purchases
    WHERE organization_id=p_org AND state NOT IN ('registered','replaced')
  ),'[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION app_private.play_subscription_state(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_private.play_subscription_state(text) TO menuminute_app;

-- Billing role: look up the registered organization/product for a token (RTDN and verification).
CREATE FUNCTION app_private.play_purchase_lookup(p_token text) RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT jsonb_build_object('organizationId',organization_id,'product',product_key,'state',state)
  FROM app_private.play_purchases WHERE purchase_token=p_token
$$;
REVOKE ALL ON FUNCTION app_private.play_purchase_lookup(text) FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.play_purchase_lookup(text) TO menuminute_billing;

-- Billing role: the ONLY writer of Play-derived entitlement state. The caller (application) has already
-- re-queried the Google Play Developer API; nothing is trusted from a notification body.
-- p_state is the normalized Play subscription state:
--   pending|active|canceled|grace|on_hold|paused|expired|revoked
-- Entitled (paid access) states: active, canceled (auto-renew off, still paid to expiry), grace.
CREATE FUNCTION app_private.record_play_state(
  p_event text,p_token text,p_product text,p_play_product text,p_base_plan text,
  p_state text,p_expiry timestamptz,p_auto_renewing boolean,p_order text,
  p_linked_token text,p_test boolean,p_acknowledged boolean,p_currency text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public,pg_temp AS $$
DECLARE pur app_private.play_purchases%ROWTYPE;
        entitled boolean; new_state text; gid text; cur entitlement_grants%ROWTYPE;
        cap text:=CASE p_product WHEN 'kitchen_pro' THEN 'kitchen.new' ELSE 'ordering.new' END;
        bundle text;
        ccy text:=CASE WHEN p_currency='INR' THEN 'INR' ELSE 'USD' END;
BEGIN
  IF length(p_event) NOT BETWEEN 8 AND 256
     OR p_state NOT IN ('pending','active','canceled','grace','on_hold','paused','expired','revoked')
     OR p_product NOT IN ('ordering','kitchen_pro') OR length(p_play_product) NOT BETWEEN 1 AND 200
     OR (p_state IN ('active','canceled','grace','on_hold','paused','expired') AND p_expiry IS NULL)
  THEN RAISE EXCEPTION 'Invalid Google Play subscription state' USING ERRCODE='22023'; END IF;
  SELECT * INTO pur FROM app_private.play_purchases WHERE purchase_token=p_token FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown Google Play purchase' USING ERRCODE='22023'; END IF;
  IF pur.product_key<>p_product THEN
    RAISE EXCEPTION 'Purchase product mismatch' USING ERRCODE='42501';
  END IF;
  IF pur.state='replaced' THEN RETURN jsonb_build_object('state','replaced','entitled',false); END IF;
  -- Event idempotency: a redelivered notification re-evaluates the same re-queried state harmlessly,
  -- but is recorded once.
  INSERT INTO app_private.play_events(event_id,purchase_token,kind,resulting_state)
    VALUES(p_event,p_token,'state',p_state) ON CONFLICT (event_id) DO NOTHING;

  entitled:=p_state IN ('active','canceled','grace') AND p_expiry>clock_timestamp();
  new_state:=CASE WHEN p_state IN ('active','canceled','grace') AND NOT entitled THEN 'expired' ELSE p_state END;

  PERFORM 1 FROM organizations WHERE id=pur.organization_id FOR UPDATE;
  SELECT * INTO cur FROM entitlement_grants WHERE id=pur.active_grant_id;

  IF entitled THEN
    -- Only an operator-approved global Kitchen release allows provider-paid Kitchen grants.
    IF cap='kitchen.new' AND NOT app_private.kitchen_commerce_enabled()
       AND (NOT FOUND OR cur.revoked_at IS NOT NULL OR cur.ends_at<>p_expiry) THEN
      RAISE EXCEPTION 'Kitchen Pro paid release has not been approved' USING ERRCODE='42501';
    END IF;
    IF NOT FOUND OR cur.revoked_at IS NOT NULL OR cur.ends_at<=clock_timestamp() OR cur.ends_at<>p_expiry THEN
      UPDATE entitlement_grants SET revoked_at=clock_timestamp()
       WHERE id=pur.active_grant_id AND revoked_at IS NULL;
      -- Resubscribe / plan-change flows give the new token a link to the one it replaces. Stop honoring
      -- the old token first (same organization only) so one subscription never holds two live grants
      -- and the old grant is not mistaken for a competing entitlement below.
      IF p_linked_token IS NOT NULL AND p_linked_token<>p_token THEN
        UPDATE entitlement_grants SET revoked_at=clock_timestamp()
         WHERE revoked_at IS NULL AND id=(
           SELECT old.active_grant_id FROM app_private.play_purchases old
            WHERE old.purchase_token=p_linked_token AND old.organization_id=pur.organization_id);
        UPDATE app_private.play_purchases SET state='replaced',active_grant_id=NULL,
          updated_at=clock_timestamp()
         WHERE purchase_token=p_linked_token AND organization_id=pur.organization_id;
      END IF;
      IF EXISTS(SELECT 1 FROM entitlement_grants e WHERE e.organization_id=pur.organization_id
          AND e.capability=cap AND e.revoked_at IS NULL
          AND e.operator NOT IN ('auto-trial','dunning-grace')
          AND e.starts_at<p_expiry AND e.ends_at>clock_timestamp()) THEN
        -- Another paid/operator entitlement already covers this window. Google has been paid, so never
        -- fail silently and never double-grant: surface for refund/cancellation by an operator.
        UPDATE app_private.play_purchases SET state='conflict',expiry_time=p_expiry,
          auto_renewing=p_auto_renewing,latest_order_id=p_order,play_product_id=p_play_product,
          base_plan_id=p_base_plan,test_purchase=p_test,last_verified_at=clock_timestamp(),
          updated_at=clock_timestamp(),active_grant_id=NULL
         WHERE purchase_token=p_token;
        RETURN jsonb_build_object('state','conflict','entitled',false);
      END IF;
      -- A verified purchase supersedes an automatic trial / retry grace window.
      UPDATE entitlement_grants SET revoked_at=clock_timestamp()
       WHERE organization_id=pur.organization_id AND capability='ordering.new'
         AND operator IN ('auto-trial','dunning-grace') AND revoked_at IS NULL AND ends_at>clock_timestamp();
      gid:=gen_random_uuid()::text;
      INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,
        operator,reason,request_key)
      VALUES(gid,pur.organization_id,cap,ccy,clock_timestamp(),p_expiry,'google-play',
        'Verified Google Play subscription '||COALESCE(p_order,'(no order)'),
        'play:'||gen_random_uuid()::text);
      IF cap='kitchen.new' THEN
        -- Kitchen Pro includes ordering: minted from the SAME verified purchase, never a guessed plan.
        IF NOT EXISTS(SELECT 1 FROM entitlement_grants e WHERE e.organization_id=pur.organization_id
            AND e.capability='ordering.new' AND e.revoked_at IS NULL
            AND e.starts_at<=clock_timestamp() AND e.ends_at>=p_expiry) THEN
          bundle:=gen_random_uuid()::text;
          INSERT INTO entitlement_grants(id,organization_id,capability,billing_currency,starts_at,ends_at,
            operator,reason,request_key)
          VALUES(bundle,pur.organization_id,'ordering.new',ccy,clock_timestamp(),p_expiry,'google-play',
            'Kitchen Pro bundled ordering via verified Google Play purchase',
            'play:'||gen_random_uuid()::text);
          INSERT INTO app_private.kitchen_paid_ordering_grants(kitchen_grant_id,ordering_grant_id)
            VALUES(gid,bundle);
        END IF;
      END IF;
    ELSE
      gid:=cur.id;
    END IF;
  ELSE
    -- Hold/pause/expiry/revocation/pending: any still-running Play grant ends now. Never trust a Play
    -- expiry timestamp alone for a revoked purchase.
    UPDATE entitlement_grants SET revoked_at=clock_timestamp()
     WHERE id=pur.active_grant_id AND revoked_at IS NULL AND ends_at>clock_timestamp();
    gid:=NULL;
  END IF;

  UPDATE app_private.play_purchases SET state=new_state,expiry_time=COALESCE(p_expiry,expiry_time),
    auto_renewing=p_auto_renewing,latest_order_id=COALESCE(p_order,latest_order_id),
    linked_purchase_token=COALESCE(p_linked_token,linked_purchase_token),
    play_product_id=p_play_product,base_plan_id=p_base_plan,test_purchase=p_test,
    acknowledged_at=CASE WHEN p_acknowledged THEN COALESCE(acknowledged_at,clock_timestamp())
                         ELSE acknowledged_at END,
    active_grant_id=gid,billing_currency=ccy,last_verified_at=clock_timestamp(),
    updated_at=clock_timestamp()
   WHERE purchase_token=p_token;

  -- Ready outlets begin kitchen routing now; unconfigured outlets stay on the merchant board.
  IF entitled AND cap='kitchen.new' THEN
    PERFORM app_private.kitchen_auto_paid_activate(r.id)
      FROM restaurants r WHERE r.organization_id=pur.organization_id AND r.is_active;
  END IF;
  RETURN jsonb_build_object('state',new_state,'entitled',entitled,'grantId',gid);
END $$;
REVOKE ALL ON FUNCTION app_private.record_play_state(text,text,text,text,text,text,timestamptz,boolean,text,text,boolean,boolean,text)
  FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.record_play_state(text,text,text,text,text,text,timestamptz,boolean,text,text,boolean,boolean,text)
  TO menuminute_billing;

-- Billing role: dedupe a Pub/Sub delivery that carries no registered token (e.g. test notifications or a
-- purchase that was never registered). Returns false when this messageId was already processed.
CREATE FUNCTION app_private.record_play_notification(p_event text,p_kind text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  IF length(p_event) NOT BETWEEN 8 AND 256 THEN
    RAISE EXCEPTION 'Invalid notification id' USING ERRCODE='22023';
  END IF;
  INSERT INTO app_private.play_events(event_id,kind) VALUES(p_event,left(p_kind,64))
    ON CONFLICT (event_id) DO NOTHING;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION app_private.record_play_notification(text,text)
  FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.record_play_notification(text,text) TO menuminute_billing;

-- Billing role: Play Ordering subscriptions still renewing in an organization that now holds a verified
-- Kitchen Pro purchase (Kitchen includes Ordering, so they must stop renewing).
CREATE FUNCTION app_private.play_superseded_by(p_token text) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT COALESCE(array_agg(o.purchase_token ORDER BY o.created_at),'{}'::text[])
  FROM app_private.play_purchases k
  JOIN app_private.play_purchases o
    ON o.organization_id=k.organization_id AND o.product_key='ordering'
   AND o.purchase_token<>k.purchase_token AND o.superseded_at IS NULL
   AND o.state IN ('active','grace') AND o.auto_renewing
  WHERE k.purchase_token=p_token AND k.product_key='kitchen_pro'
    AND k.state IN ('active','canceled','grace') AND k.active_grant_id IS NOT NULL
$$;
REVOKE ALL ON FUNCTION app_private.play_superseded_by(text) FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.play_superseded_by(text) TO menuminute_billing;

-- Record, AFTER Google acknowledged the cancellation, that an Ordering purchase will not renew. Never
-- changes an entitlement: already-paid days stay active.
CREATE FUNCTION app_private.mark_play_superseded(p_kitchen text,p_ordering text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  UPDATE app_private.play_purchases o SET superseded_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE o.purchase_token=p_ordering AND o.product_key='ordering' AND o.superseded_at IS NULL
     AND EXISTS(SELECT 1 FROM app_private.play_purchases k
                WHERE k.purchase_token=p_kitchen AND k.product_key='kitchen_pro'
                  AND k.organization_id=o.organization_id AND k.active_grant_id IS NOT NULL);
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION app_private.mark_play_superseded(text,text) FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.mark_play_superseded(text,text) TO menuminute_billing;

-- Kitchen routing and the bundled-ordering revoke previously recognised only Razorpay grants. Extend both
-- to Google Play, keeping every other condition unchanged.
CREATE OR REPLACE FUNCTION app_private.kitchen_paid_subscription_active(p_org text) RETURNS boolean
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
 SELECT app_private.kitchen_commerce_enabled() AND (EXISTS(
   SELECT 1 FROM app_private.razorpay_subscriptions s
   JOIN entitlement_grants e ON e.organization_id=s.organization_id
    AND e.id IN (
      SELECT c.grant_id FROM app_private.razorpay_charges c WHERE c.subscription_id=s.subscription_id
      UNION ALL
      SELECT c.grant_id FROM app_private.razorpay_resume_grants c WHERE c.subscription_id=s.subscription_id
    )
   JOIN organizations o ON o.id=s.organization_id AND o.is_active
   WHERE s.organization_id=p_org AND s.product_key='kitchen_pro'
     -- Cancelled/completed subscriptions retain their already-paid period.
     AND s.status IN ('active','cancelled','completed') AND s.current_end>clock_timestamp()
     AND e.capability='kitchen.new' AND e.revoked_at IS NULL
     AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()
 ) OR EXISTS(
   SELECT 1 FROM app_private.play_purchases p
   JOIN entitlement_grants e ON e.id=p.active_grant_id
   JOIN organizations o ON o.id=p.organization_id AND o.is_active
   WHERE p.organization_id=p_org AND p.product_key='kitchen_pro'
     AND p.state IN ('active','canceled','grace') AND p.expiry_time>clock_timestamp()
     AND e.capability='kitchen.new' AND e.revoked_at IS NULL
     AND e.starts_at<=clock_timestamp() AND e.ends_at>clock_timestamp()
 ))
$fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_paid_subscription_active(text)
 FROM PUBLIC,menuminute_app,menuminute_worker,menuminute_billing;

CREATE OR REPLACE FUNCTION app_private.kitchen_bundle_revoke() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $fn$
BEGIN
 IF OLD.capability='kitchen.new' AND OLD.operator IN ('razorpay-webhook','google-play')
    AND OLD.revoked_at IS NULL AND NEW.revoked_at IS NOT NULL THEN
   UPDATE entitlement_grants SET revoked_at=clock_timestamp()
     WHERE id IN (
       SELECT g.ordering_grant_id FROM app_private.kitchen_paid_ordering_grants g
       WHERE g.kitchen_grant_id=OLD.id
     ) AND revoked_at IS NULL;
 END IF;
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION app_private.kitchen_bundle_revoke() FROM PUBLIC;
