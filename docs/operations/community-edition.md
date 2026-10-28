# Community Edition installation contract

Community Edition is an **explicit deployment** on an independently operated database. The hosted
service at food.bababuilds.com MUST retain `COMMUNITY_EDITION=false`. Application flags alone
do not authorize premium capabilities.

## Isolated first installation

1. Provision the standard restricted `menuminute_app` and `menuminute_worker` accounts.
   The billing migration also requires the restricted `menuminute_billing` role, even when
   Razorpay is disabled. Do not give any of these roles table ownership or BYPASSRLS.
2. Apply the normal checksummed SQL migrations as the isolated migration owner.
3. Before public signup, use **the migration-owner connection only** to run this transaction.
   It does not work through the normal web/database account.

```sql
BEGIN;
LOCK TABLE public.users IN SHARE ROW EXCLUSIVE MODE;
DO $$
BEGIN
  IF (SELECT count(*) FROM public.users) > 1 THEN
    RAISE EXCEPTION 'Refusing Community Edition with more than one user';
  END IF;
END $$;
UPDATE app_private.deployment_edition SET edition='community' WHERE singleton;
INSERT INTO public.entitlement_grants (
  id,organization_id,capability,billing_currency,starts_at,ends_at,operator,reason,request_key
)
SELECT gen_random_uuid()::text,o.id,cap,'INR',clock_timestamp(),'infinity'::timestamptz,
  'community-edition','Local self-hosted edition',gen_random_uuid()::text
FROM public.organizations o
CROSS JOIN unnest(ARRAY['ordering.new','kitchen.new']) cap
WHERE NOT EXISTS (
  SELECT 1 FROM public.entitlement_grants e
  WHERE e.organization_id=o.id AND e.capability=cap AND e.revoked_at IS NULL
    AND e.ends_at='infinity'::timestamptz
);
COMMIT;
```

4. Set `COMMUNITY_EDITION=true` and `RAZORPAY_ENABLED=false` in the root-protected web environment.
5. Run the application's deployment role/edition preflight before exposing HTTPS.
6. Register the first account. A database trigger serializes and rejects further account creation.

**Limits:** Community entitlements do not weaken outlet RBAC, guest token checks, media
requirements, or Kitchen Pro's existing safety/operational-readiness gates. Kitchen workstation
setup must still satisfy those operational gates. This edition must not claim that kitchen
configuration and launch checks can be skipped.

## Backups and migration discipline

Keep `app_private.deployment_edition` owner-controlled and never grant UPDATE on it to the
web application. The deployment edition belongs to the database instance, not a request header,
cookie or environment string supplied by a client. Test restoration in a separate environment;
a restored cloud database must not be silently reclassified as Community Edition.

An MIT-licensed application can be modified by recipients. The single-account restriction is a
capability of the unmodified Community build, not a contractual anti-SaaS license restriction.
