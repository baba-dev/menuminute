# Razorpay billing rollout: restricted-provider event authority

Paid checkout is **off by default**. Do not enable live charges merely because
`0034_razorpay_billing_entitlements.sql` was applied. Existing Kitchen Pro
controlled-pilot safeguards remain in place. The kitchen catalog entry is
commercially inactive pending an independent release approval.

## Database provisioning (before migrating)

Create a dedicated `menuminute_billing` LOGIN role as the PostgreSQL administrator
with `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS` and a generated
unique secret. It must NOT inherit `menuminute_app`, `menuminute_worker` or the
migration owner. Grant database CONNECT; the forward-only migration grants only
`USAGE` on `app_private` and EXECUTE on the two narrowly scoped webhook functions.
Do not grant table SELECT/INSERT/UPDATE/DELETE. The migration will fail closed if
the role was not provisioned; never work around it with migration-owner credentials.
Keep the connection string in the root-owned web environment and not in a
NEXT_PUBLIC value or worker configuration.

## Provider preflight

- In the Razorpay Dashboard create a real **monthly INR** ordering plan for ₹119
  (`11900` paise). Verify its plan ID, recurrence, pricing, GST policy and merchant account.
- Create a webhook with a distinct high-entropy signing secret, subscribed to
  `subscription.charged`, `subscription.paused`, `subscription.halted`,
  `subscription.cancelled`, `subscription.completed`, `subscription.resumed`,
  `subscription.pending`, and `refund.processed`.
- Confirm test and live keys are never crossed. Verify signed event fixtures
  against the real provider sandbox before processing production charges.
- Install `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`,
  `RAZORPAY_PLAN_ORDERING_ID`, `BILLING_DATABASE_URL` in the root-protected web env.
  Keep `RAZORPAY_KITCHEN_ENABLED=false`. Run environment preflight.
- Only after the payment and cancellation smoke tests pass, switch
  `RAZORPAY_ENABLED=true` and activate the reviewed release.

## Security and lifecycle invariants

The normal web role registers checkout subscriptions only for an authenticated
organization owner. A separate payment role stores verified charges and updates
entitlements. A subscription must already exist in the local registry before
any charge can create a grant. Payment notes cannot choose an organization or
capability. Missing plan, payment ID, captured status, INR amount or valid billing
period must fail closed. Event and payment IDs are unique in the database.

Only charges activate new paid ordering work; an authorization or payment.captured
event alone does not. A paused/halted/expired subscription revokes paid grants;
cancellation leaves access through its already-paid billing-period end. A verified
`refund.processed` event can revoke the specific fully refunded payment period, not
unrelated later renewal periods; partial refunds do not revoke a whole entitlement.
The webhook returns a retriable 503 for database reconciliation failures.

## Operator runbook

1. Observe the initial pending subscription in organization billing; check the
   corresponding Razorpay subscription before retrying an abandoned checkout.
2. If the provider charged but local access remains unavailable, inspect webhook
   delivery logs and the billing receipt ledger with the migration owner. Do not
   issue a manual free grant to mask a provider reconciliation problem.
3. On provider incident, disable checkout with `RAZORPAY_ENABLED=false` while
   preserving existing paid grant expiry and free QR menus. Record the outage.
4. Preserve the webhook payload digest, payment ID, period, and event timestamps.
   Never log payment credentials, raw sensitive payloads or database passwords.
5. To roll back a release, use the forward-only migration recovery protocol;
   never delete billing history or rewrite applied migration files.

### Explicit limitations before commercial rollout

An end-to-end live provider sandbox run, customer cancellation self-service,
renewal/reconciliation retry automation, tax/invoice workflow, and Kitchen Pro
commercial activation require separate verified release sign-off. Do not
advertise those abilities as enabled without their corresponding evidence.
