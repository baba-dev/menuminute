# Android release program — phases A–F

**Status: source integration candidate, NOT approved for Google Play production.** Do not mark this phase completed merely because GitHub CI is green.

## Architecture

MenuMinute remains one Next.js application. `android/` is a tiny Android Trusted Web Activity using Android Browser Helper and Android 16 / API 36. The PWA manifest starts at `/app`, which validates a real server-side session; the Play launcher starts at `/api/app/launch`, which marks the browser profile as **consumption only** and then redirects to `/app`. Authentication, outlet RBAC, POS, Kitchen and the ordering ledger are unchanged.

The Play entry sets an HttpOnly, Secure, SameSite=Lax cookie. This cookie is not an authentication or authorization credential; it is deliberately only a restriction on commerce. Since Chrome and the TWA may share cookies, installing the Play build can also hide checkout in a normal Chrome tab on the device. Users can manage subscriptions from another browser/device; **the app must not link them to Razorpay payment pages.** The cookie is not cryptographic proof that a request came from Play; the experience must still be manually audited across every route.

## A — stabilization (included)

- PR #335 responsive test repair via #338.
- Every required browser shard, integration test and TypeScript gate must pass at the exact release commit SHA.
- Verify current production version before deploy; screenshots are not proof of native Android behavior.

## B — Android packaging (scaffolded)

- Android package `com.bababuilds.menuminute`; confirm before first Play upload.
- Compile/target SDK 36; min SDK 26; Java 17; Android Browser Helper 2.7.4.
- CI builds a debug APK and unsigned release AAB, and its result is required by the existing quality gate.
- The protected `Android signed internal-release candidate` workflow signs **only reviewed current-main native changes** after successful push CI, and still supports explicit manual release candidates. Its output has automatically managed version codes and **never** uploads directly to Play. Play upload is a separate manual, reviewer-protected **internal draft** action; see [`release-automation.md`](release-automation.md).
- Never commit keystores or app-signing credentials.

## C — merchant UX

- Installed PWA starts at `/app`, not the marketing homepage. Play TWA launches `/api/app/launch`.
- Signed-out merchants see login. Existing merchants see Dashboard. New accounts use `/start` onboarding.
- Normal diner QR `/m/...` URLs are independent. Public menu offline snapshots remain anonymous and never queue orders.
- Verify Google OAuth, password/MFA, app Back handling, external links, uploads, screen orientation and background/restart behavior on devices.

## D — billing, identity and compliance

- **Play Billing is implemented (disabled by default, `PLAY_BILLING_ENABLED`).** The Play client sells Ordering through Google Play Billing via the Digital Goods API; it never shows Razorpay checkout, Razorpay subscriptions or external payment links. Web subscriptions remain Razorpay. Design, Play Console/GCP setup, state mapping and runbook: [`play-billing.md`](play-billing.md). Declarations and policy checklist: [`play-compliance.md`](play-compliance.md).
- The Play cookie still hides Razorpay checkout (`/api/organizations/{id}/billing/checkout` returns 403 for Play-marked sessions); Play purchases use `/billing/play/intent` and `/billing/play/verify`, which require the Play marker and an organization **owner**.
- Entitlements come only from the server re-querying the Google Play Developer API and the restricted billing DB identity (`record_play_state`). One provider per organization. Kitchen Pro is sold through Play when `PLAY_KITCHEN_ENABLED` and the global Kitchen release are on. The billing library is `billing:1.2.0` (Play Billing Library 8.3.0).
- Public policy: `/privacy`; deletion: `/delete-account`. Owner has confirmed that account deletion works. Play Console still requires a functioning process and a tested reviewer-access flow.
- Publish `/.well-known/assetlinks.json` with `ANDROID_PLAY_APP_SIGNING_SHA256` set to the exact **Play App Signing** SHA-256 fingerprint. A missing or invalid fingerprint deliberately returns 503; domain verification MUST pass before full-screen Play acceptance.
- Reviewer demo account cannot be the only review route if it blocks advertised features.

## E — Android device reliability and thermal printing

- Operational POS receipts receive immutable server-rendered totals and can be encoded to 58/80 mm ESC/POS locally.
- Android Chrome in installed PWA/TWA mode can offer **Bluetooth LE GATT** printing after user taps the button and selects a compatible printer. Supported tested code paths currently include FFE0/FFE1 and ISSC-style BLE characteristics. No auto BLE send; chooser requires a user gesture.
- Existing Android system Print / Save PDF remains available. Fiscal/statutory invoices retain their existing print pipeline.
- **Bluetooth Classic SPP, USB printers and vendor-specific printers are NOT supported by the TWA bridge in this phase.** They need a native implementation and hardware compatibility testing before such support may be advertised.
- No order replay or offline finance writes, even if Bluetooth printing fails.

## F — distribution gates

1. Required web CI and Android assembly pass on the exact SHA.
2. Real physical devices pass the matrix in `device-test-matrix.md`.
3. Sign upload-key AAB in the restricted release workflow; verify AAB signature, versionCode, manifest and target SDK.
4. Deploy the same reviewed web SHA; install Play App Signing fingerprint environment variable, verify assetlinks HTTP 200, JSON identity and fullscreen TWA.
5. Set up Play Console package, Play App Signing, app access/reviewer credentials, content rating, Data Safety, account deletion URL, privacy policy, screenshots and store listing.
6. Internal test, then closed test if required by account eligibility, then staged production only after operator sign-off. Monitor login, crash/ANR, order/printing complaints and reversal process.

## Release blockers that cannot be proven by source inspection

Play Console account / signing certificates, live-server environment, real-device BLE printer compatibility, Google OAuth in Chrome TWA, Play review, regulatory invoices and proper store approval all need independent evidence. **Do not merge or publish based solely on a build that compiles.**
