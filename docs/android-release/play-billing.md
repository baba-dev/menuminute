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
6. **Kitchen Pro mirrors Razorpay exactly.** It needs `PLAY_KITCHEN_ENABLED=true` **and** the platform's global Kitchen
   commercial release switch (`kitchen_commerce_enabled()`); the ledger refuses to grant otherwise. A verified Kitchen
   purchase mints the bundled Ordering grant from the same purchase (`kitchen_paid_ordering_grants`), revokes it together
   with the Kitchen grant (the existing `kitchen_bundle_revoke` trigger now covers `google-play`), and activates ready
   outlets (`kitchen_auto_paid_activate` through the extended `kitchen_paid_subscription_active`).
7. **Upgrade path inside Play.** A live Play _Ordering_ subscription does not block a Kitchen Pro purchase. Once Kitchen
   Pro is verified the server calls `purchases.subscriptions.cancel` on the Ordering token so it stops renewing; its
   already-paid days stay active (`play_superseded_by` / `mark_play_superseded`). Kitchen→Ordering downgrade is not
   offered while Kitchen is live.
8. **Abuse bounds.** `intent` and `verify` are rate limited fail-closed in Redis (30 per account / 60 per organization per
   10 minutes, 2000 global) because each call can cost a Google API request.

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
   - Product ID: `menuminute_ordering` (or set `GOOGLE_PLAY_SKU_ORDERING`). Create a second subscription,
     `menuminute_kitchen_pro` (`GOOGLE_PLAY_SKU_KITCHEN`), with the same single `monthly` base plan, when enabling
     Kitchen Pro.
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
PLAY_KITCHEN_ENABLED=false            # true only after the Kitchen commercial release is approved
GOOGLE_PLAY_SKU_KITCHEN=menuminute_kitchen_pro
GOOGLE_PLAY_BASE_PLAN_KITCHEN=monthly
BILLING_DATABASE_URL=<the existing restricted menuminute_billing URL>
```

`pnpm env:validate` refuses to boot when Play billing is on without the service account, RTDN identity, an isolated
billing DB URL, or when `BILLING_DATABASE_URL` equals `DATABASE_URL`, or in Community Edition.

Deploy migration `0111_google_play_billing.sql` through the normal checksummed pipeline (forward-only, additive; it
creates two `app_private` tables and the Play functions; it replaces only `kitchen_paid_subscription_active` and `kitchen_bundle_revoke` (superset of the Razorpay behaviour)).

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
- [ ] Kitchen Pro (when enabled): purchase unlocks Kitchen **and** Ordering; a ready outlet starts routing; an on-hold
      state removes both; upgrading from a live Play Ordering plan cancels Ordering renewal in Play (it shows "canceled").
- [ ] Rapid repeated taps on Subscribe return a rate-limit message, not a Google error storm.
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

- Purchase tokens are bearer secrets and the Digital Goods API cannot attach an account id to a purchase. Registration
  is therefore trusted to the authenticated **owner** who submits a token, which Google only reveals to the purchaser.
  A leaked token could be attached by another owner before the purchaser does; it can never be re-bound afterward and
  every call is rate limited. If stronger binding is required, move to a native Play Billing flow that sets
  `obfuscatedExternalAccountId`.
- Only monthly single-base-plan subscriptions are supported; the server rejects other shapes.
- Kitchen→Ordering downgrade and yearly plans are not offered.
- Real Google calls (purchase, RTDN, cancel, acknowledge) are **unverified** until the on-device checklist above is run
  against a license-tester account. Unit and integration tests stub Google; the Android CI lane proves the app compiles.
