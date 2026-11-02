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
- **Kitchen Pro is a flat ₹499 a month (`49900` paise) for up to 10 outlets.** Create a monthly INR plan
  at that amount and set its ID as `RAZORPAY_PLAN_KITCHEN_ID`. The webhook refuses a charge below the
  catalog amount for the plan it belongs to, and refuses any plan id it does not know. The product has
  not launched, so there is no older plan or subscriber to support; use new Razorpay keys and plans.
- **Kitchen Pro replaces Ordering.** When a Kitchen Pro payment is verified, the webhook cancels any
  Ordering subscription of the same organization at the end of its paid cycle (paid days stay active).
  A provider failure makes the webhook return 503 so the provider retries. Before this fix an owner could
  be billed for both: run `scripts/billing-double-billing-audit.ts` once (read-only) and cancel any
  Ordering subscription it lists in the Razorpay Dashboard.
- **There is no per-outlet add-on.** Kitchen Pro is one flat price; the cap of 10 outlets is enforced in
  the application (see plans-and-limits.md).
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

## Pre-launch code audit (2026-11-02)

The owner chose to go live without a Razorpay sandbox run, so the payment path was audited in code and the
paths that can lose money were exercised against the real database functions (`tests/billing-upgrade-path.integration.test.ts`,
`tests/double-billing.integration.test.ts`).

- **Verified:** the webhook checks the HMAC over the raw body in constant time before anything else; each event
  and each payment id is recorded once (a redelivered webhook does nothing); the organization and capability come
  from the server-side checkout registry, never from payment notes; the plan id and a captured INR amount at or
  above the catalog price are required; periods must be contiguous (a renewal starts where the last period ended);
  the web role cannot reach the ledger (only the isolated billing role can).
- **Exercised:** upgrading to Kitchen Pro in the middle of a paid Ordering month grants Kitchen Pro and keeps
  ordering on; a normal renewal is accepted for both plans; an overlapping period is refused; a full refund of the
  Kitchen Pro payment ends Kitchen and its bundled ordering but not a separately paid Ordering month.
- **Changed:** cancellations now send `cancel_at_cycle_end: 1`, the value Razorpay documents, instead of a JSON boolean.
- **Not exercised against the real provider:** the exact shape of Razorpay's live webhook payloads and the provider's
  response to a cancellation. Watch the first live purchase: the webhook delivery in the Razorpay dashboard should be
  HTTP 200, and the checks in the rollout section should show an active subscription and grant.
- **Operational note:** every event Razorpay sends to this webhook for a subscription this app did not create (for
  example another product on the same Razorpay account) is answered with an error, and Razorpay retries it. Use a
  separate Razorpay account or webhook for anything else, or expect failed deliveries in the dashboard.
- **Known gaps:** no GST invoices or tax handling, no emails for failed payments beyond the plan reminders, and
  international pricing is not available.
