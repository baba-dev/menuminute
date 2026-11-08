# Google Play Billing — design, setup and operations

**Status: implemented in source, disabled by default (`PLAY_BILLING_ENABLED=false`). Not approved for production.**
Enabling it needs the Play Console, Google Cloud and host provisioning below, a physical-device test pass, and
operator sign-off. A green CI run is not evidence that any of these exist.

Supersedes the "consumption-only, no purchase" stance in the earlier `README.md` §D. Razorpay remains the web provider.

## Why Play Billing

Google Play requires digital subscriptions sold **inside an app distributed on Google Play** to use Google Play's
billing system. MenuMinute's paid plans unlock software features, so the Play app sells through Play Billing and
never renders Razorpay checkout. Do not link or steer Play users to external payment pages from the Play app.
(Policy: <https://support.google.com/googleplay/android-developer/answer/10281818>. Re-check the current text and
any regional alternative-billing programmes with counsel before launch; this document does not assume one.)

## Architecture

```
Play app (TWA)                 MenuMinute server                         Google
──────────────                 ─────────────────                         ──────
Billing page
  POST …/billing/play/intent ─▶ owner? one provider only? ─ SKU ─▶
  Digital Goods / PaymentRequest ───────────────────────────────────────▶ Play purchase sheet
  ◀──── purchaseToken ───────────────────────────────────────────────────
  POST …/billing/play/verify ─▶ register_play_purchase (owner binds token to org)
                               fetch purchases.subscriptionsv2.get ─────▶ source of truth
                               record_play_state (billing DB identity) ─▶ entitlement_grants
                               acknowledge (only if entitled) ─────────▶ subscriptions.acknowledge
Pub/Sub push ─────────────────▶ POST /api/webhooks/billing/google-play
                               verify Google OIDC token, re-query, record
```

Invariants (do not weaken):

1. **No entitlement from a client callback or a notification body.** The purchase token is only a lookup key. Every
   change is derived from a fresh `subscriptionsv2.get` response fetched with our own service account.
2. **Only the restricted `menuminute_billing` identity writes entitlements** (`app_private.record_play_state`). The
   web role can only _register_ a token for an organization its caller **owns** (`register_play_purchase`) and cannot
   re-bind a token to another organization.
3. **One provider per organization.** `play_checkout_blocker` refuses a Play purchase while Razorpay is billing (or an
   operator/paid entitlement exists); `play_subscription_blocks_razorpay` refuses Razorpay checkout while Play is
   billing. Automatic trial / dunning-grace grants are superseded by a verified purchase, exactly as for Razorpay.
4. **Acknowledge only after the grant is recorded.** An unacknowledged purchase is refunded automatically by Google
   after 3 days, so a purchase the ledger refuses (state `conflict`) is deliberately left unacknowledged.
5. **Idempotent and re-entrant.** Pub/Sub redelivery, duplicate verification, and app restore all converge on the same
   state (`play_events` records each event id once; one live grant per purchase token).
6. **Launch scope is Ordering only.** Kitchen Pro bundling and auto-routing live in the Razorpay charge function and
   are not replicated. The DB constrains `product_key` to `ordering`, and the UI hides Kitchen Pro in the Play app.

### State mapping

| Play `subscriptionState`               | Ledger state | Access                                                                |
| -------------------------------------- | ------------ | --------------------------------------------------------------------- |
| `ACTIVE`                               | `active`     | Entitled until `expiryTime`                                           |
| `CANCELED` (auto-renew off)            | `canceled`   | Entitled until `expiryTime`, then expires                             |
| `IN_GRACE_PERIOD`                      | `grace`      | Entitled until the grace expiry                                       |
| `ON_HOLD` / `PAUSED`                   | same         | **Revoked immediately**                                               |
| `PENDING`                              | `pending`    | None until paid                                                       |
| `EXPIRED`, `PENDING_PURCHASE_CANCELED` | `expired`    | None                                                                  |
| Voided purchase (refund/chargeback)    | `revoked`    | Revoked immediately, **only if the voided order is the latest order** |
| Any other / multi-line-item response   | rejected     | Never granted (fails closed)                                          |

Other ledger states: `registered` (token bound, not yet verified, grants nothing), `replaced` (superseded by a
resubscribe via `linkedPurchaseToken`), `conflict` (Google was paid but another entitlement already covers the window;
needs an operator, see runbook).

## One-time setup

### 1. Play Console

1. Create the app with package `com.bababuilds.menuminute` (permanent). Enrol in **Play App Signing**; copy the _app
   signing_ SHA-256 into `ANDROID_PLAY_APP_SIGNING_SHA256` (not the upload key).
2. **Monetize → Products → Subscriptions → Create subscription**
   - Product ID: `menuminute_ordering` (or set `GOOGLE_PLAY_SKU_ORDERING`).
   - **Exactly one base plan**, id `monthly` (or set `GOOGLE_PLAY_BASE_PLAN_ORDERING`), billing period 1 month,
     auto-renewing, **no add-ons / one product per subscription**. The server rejects any other shape.
   - Prices must match the published Ordering price book per region (`src/modules/billing/catalog.ts`). Pricing changes
     in Play must be reviewed together with the catalog and the public pricing page.
   - Set grace period and account hold per your dunning policy; the ledger handles both.
3. **Setup → Payments profile**: a merchant account must be linked before paid products can be published.
4. **Testing → License testing**: add tester Gmail accounts. Test purchases come back with `testPurchase` and renew on
   a compressed schedule; they are stored with `test_purchase=true`.

### 2. Google Cloud / API access

1. In the Google Cloud project linked to Play Console, enable **Google Play Android Developer API** and **Cloud Pub/Sub API**.
2. Create two service accounts:
   - `play-billing-api@…` — invited in **Play Console → Users and permissions** with only
     _View financial data_ and _Manage orders and subscriptions_. Create a JSON key.
   - `play-rtdn-push@…` — used only to sign Pub/Sub push deliveries; no Play permissions.
3. Pub/Sub: create topic `play-rtdn`; grant `google-play-developer-notifications@system.gserviceaccount.com` the
   **Pub/Sub Publisher** role on it. Create a **push subscription** to
   `https://food.bababuilds.com/api/webhooks/billing/google-play` with _Enable authentication_ = service account
   `play-rtdn-push@…` and **Audience = that exact URL**. Grant that account _Service Account Token Creator_ for Pub/Sub's
   service agent as Google documents.
4. **Monetize → Monetization setup → Real-time developer notifications**: enter the topic, send a test notification.

### 3. Host environment (protected env file only — never git, logs or PR text)

```
PLAY_BILLING_ENABLED=true
GOOGLE_PLAY_PACKAGE_NAME=com.bababuilds.menuminute
GOOGLE_PLAY_SERVICE_ACCOUNT_JSON=<single-line JSON key of play-billing-api>
GOOGLE_PLAY_RTDN_AUDIENCE=https://food.bababuilds.com/api/webhooks/billing/google-play
GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT=play-rtdn-push@<project>.iam.gserviceaccount.com
GOOGLE_PLAY_SKU_ORDERING=menuminute_ordering
GOOGLE_PLAY_BASE_PLAN_ORDERING=monthly
BILLING_DATABASE_URL=<the existing restricted menuminute_billing URL>
```

`pnpm env:validate` refuses to boot when Play billing is on without the service account, RTDN identity, an isolated
billing DB URL, or when `BILLING_DATABASE_URL` equals `DATABASE_URL`, or in Community Edition.

Deploy migration `0111_google_play_billing.sql` through the normal checksummed pipeline (forward-only, additive; it
creates two `app_private` tables and seven functions and touches no existing object).

## Verification before enabling for real users

Run on a **physical Android device** from Play **Internal testing** with a license-tester account:

- [ ] `intent` returns the SKU; the Play sheet opens; purchase completes; plan unlocks within seconds without refresh loops.
- [ ] Server log shows the RTDN delivery (messageId) and `play_events` contains one row per message.
- [ ] Purchase appears **acknowledged** in Play Console → Order management.
- [ ] Force-close the app mid-purchase; reopen → restore (`listPurchases` → `verify`) unlocks the plan.
- [ ] Cancel in Play → UI shows "Ends <date>", access continues to expiry, then drops.
- [ ] Account hold / pause (license-tester accelerated) removes access immediately; resolving restores it.
- [ ] Refund/void the test order in Play Console → access revoked on the voided-purchase notification.
- [ ] A second organization's owner posting the same token is rejected (`23505`).
- [ ] Org with active Razorpay: Play `intent` refuses. Org with active Play: web Razorpay checkout refuses.
- [ ] Trial org: purchase ends the trial grant and starts exactly one paid grant.
- [ ] Offline/airplane purchase attempt shows a clear failure and grants nothing.
- [ ] Non-Play browser on the same account sees "Managed by Google Play" and no checkout button.

## Operations runbook

- **`conflict` purchase** (customer paid Google but already had another entitlement): it is intentionally _not
  acknowledged_, so Google refunds it automatically within 3 days. Contact the owner; if they wish to switch provider,
  cancel the other subscription first, then ask them to restore (reopen Billing in the app). Find rows with
  `SELECT organization_id,state,expiry_time FROM app_private.play_purchases WHERE state='conflict'` (owner DB role).
- **Customer paid but plan locked**: ask them to open Billing in the Play app (restore runs automatically). If it
  persists, check the Pub/Sub dead-letter queue and the `[billing] Google Play notification could not be reconciled`
  log line. Pub/Sub redelivers on any non-2xx; reconciliation failures return 503.
- **Refund**: issue it in Play Console. The voided-purchase notification revokes access; nothing to do in MenuMinute.
- **Rotating keys**: create a new service-account key, update `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, restart web, delete
  the old key. The access token cache is in-process and refreshes on its own.
- **Kill switch**: set `PLAY_BILLING_ENABLED=false` and restart. Existing grants remain until they expire; webhook
  returns 503 so Pub/Sub retains messages for later replay.

## Known limitations

- Kitchen Pro is not sold through Play yet.
- Plan changes between products inside Play (upgrade/downgrade) are not supported; one Ordering subscription only.
- The verification endpoint has no application-level rate limit beyond owner authentication; Google API quota and
  the single-row-per-token ledger bound the cost. Add the platform limiter if abuse appears.
- The Android project was not compiled in the authoring environment (Maven Central was rate-limited). The CI
  `android_twa` lane and the signed internal-release workflow are the compile evidence.
