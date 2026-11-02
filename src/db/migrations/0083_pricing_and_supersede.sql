-- 0083: Four-tier pricing and no double billing.
--  * Kitchen Pro is now INR 499 per month (3 outlets included). The seeded plan catalog row is brought
--    in line; the provider plan itself is created by the operator (see docs/operations/razorpay-billing.md)
--    and existing INR 299 subscriptions keep renewing on their original provider plan.
--  * When a Kitchen Pro payment is verified, the organization's Ordering subscription must stop renewing,
--    because Kitchen Pro already includes ordering. These two functions let the payment webhook (the
--    restricted billing identity only) find and mark those subscriptions. The provider cancellation itself
--    is made by the webhook handler. Already-paid Ordering days are never revoked.
-- Forward-only.

UPDATE subscription_plans SET display_name='Kitchen Pro',monthly_price_paise=49900,
  features='["live_kds","audio_chimes","station_routing","pos_till","multi_outlet"]'
 WHERE id='plan_kitchen_pro';
UPDATE subscription_plans SET display_name='Ordering' WHERE id='plan_ordering';
UPDATE subscription_plans SET display_name='Free',
  features='["qr_menu","ai_paper_scan","sold_out_86"]' WHERE id='plan_free';

-- Other Ordering subscriptions of the same organization that are still billing and are not already
-- scheduled to stop. Only for a Kitchen Pro subscription that has a recorded verified charge.
CREATE FUNCTION app_private.subscriptions_superseded_by(p_subscription text) RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
  SELECT COALESCE(array_agg(o.subscription_id ORDER BY o.created_at),'{}'::text[])
  FROM app_private.razorpay_subscriptions k
  JOIN app_private.razorpay_subscriptions o
    ON o.organization_id=k.organization_id AND o.product_key='ordering'
   AND o.subscription_id<>k.subscription_id AND o.cancel_requested_at IS NULL
   AND o.status IN ('active','authenticated','pending')
  WHERE k.subscription_id=p_subscription AND k.product_key='kitchen_pro'
    AND EXISTS(SELECT 1 FROM app_private.razorpay_charges c WHERE c.subscription_id=k.subscription_id)
$$;
REVOKE ALL ON FUNCTION app_private.subscriptions_superseded_by(text)
  FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.subscriptions_superseded_by(text) TO menuminute_billing;

-- Record, after the provider acknowledged it, that an Ordering subscription will not renew because Kitchen
-- Pro replaced it. Idempotent. Never changes an entitlement.
CREATE FUNCTION app_private.mark_subscription_superseded(p_kitchen text,p_ordering text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp AS $$
BEGIN
  UPDATE app_private.razorpay_subscriptions o SET cancel_requested_at=clock_timestamp(),updated_at=clock_timestamp()
   WHERE o.subscription_id=p_ordering AND o.product_key='ordering' AND o.cancel_requested_at IS NULL
     AND EXISTS(SELECT 1 FROM app_private.razorpay_subscriptions k
                WHERE k.subscription_id=p_kitchen AND k.product_key='kitchen_pro'
                  AND k.organization_id=o.organization_id
                  AND EXISTS(SELECT 1 FROM app_private.razorpay_charges c WHERE c.subscription_id=k.subscription_id));
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION app_private.mark_subscription_superseded(text,text)
  FROM PUBLIC,menuminute_app,menuminute_worker;
GRANT EXECUTE ON FUNCTION app_private.mark_subscription_superseded(text,text) TO menuminute_billing;
