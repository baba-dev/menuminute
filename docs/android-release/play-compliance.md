# Google Play compliance pack — MenuMinute Restaurant Manager

Working checklist for the Play Console declarations. **Status: draft inputs, not submitted.** Play policy and Console
forms change; read each linked page at submission time and have the owner sign off the exact live build. Items marked
**[Console]** can only be done in Play Console by the account owner; items marked **[Repo]** are implemented or
documented here.

## 1. Payments and subscriptions

| Requirement                                                                                      | Status                                                                                                                                                                        |
| ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Digital subscriptions sold in the app use Google Play Billing                                    | **[Repo]** `docs/android-release/play-billing.md`; Razorpay is never rendered in the Play app                                                                                 |
| No links/buttons steering Play users to external payment pages                                   | **[Repo]** Play billing page shows only Play checkout and a link to Google Play subscriptions                                                                                 |
| Subscription terms disclosed before purchase: price, billing period, auto-renewal, how to cancel | **[Repo]** Billing page shows price and period on the plan card; refund policy §4 explains Play cancellation. **[Console]** fill the subscription benefits/description fields |
| Cancellation is possible without contacting us                                                   | **[Repo]** "Manage in Google Play" link on the subscription row; Google Play app                                                                                              |
| Refunds follow Google Play's process for Play purchases                                          | **[Repo]** `/refund-policy` §4                                                                                                                                                |
| Purchases are verified server-side and acknowledged within 3 days                                | **[Repo]** `reconcilePlayPurchase`; conflicts are deliberately left unacknowledged                                                                                            |
| Entitlements revoked on refund, hold, pause, expiry                                              | **[Repo]** RTDN handler + `record_play_state`                                                                                                                                 |
| Uses a supported Play Billing Library                                                            | **[Repo]** `com.google.androidbrowserhelper:billing:1.2.0` = PBL 8.3.0 (required for updates after 2026-08-31)                                                                |

Policy: <https://support.google.com/googleplay/android-developer/answer/10281818> ·
Subscriptions: <https://support.google.com/googleplay/android-developer/answer/12154973>

## 2. User data and privacy

| Requirement                                                           | Status                                                                                                                                |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Public privacy policy URL, linked in Console and reachable in the app | **[Repo]** `https://food.bababuilds.com/privacy`; now names Razorpay (web) and Google Play Billing (app) and the data received        |
| Data safety form matches the **live build and live services**         | **[Console]** use `data-safety.md` (updated) as input                                                                                 |
| In-app **and** web account deletion path, URL in Console              | **[Repo]** `https://food.bababuilds.com/delete-account`; `docs/account-deletion-requests.md`. Confirm the Console "Data deletion" URL |
| Data encrypted in transit                                             | **[Repo]** HTTPS only (`usesCleartextTraffic=false`)                                                                                  |
| No selling of personal data; no ads SDKs                              | **[Repo]** none present. Declare "No ads" in Console                                                                                  |
| Bump the privacy effective date                                       | **Open** — `PRIVACY_EFFECTIVE_LABEL` is shared by several legal pages and e2e specs; change it together with counsel's sign-off       |

## 3. App content declarations **[Console]**

| Declaration                                                                   | Suggested answer (verify against the build)                                                                                                                                                                                                                                                                                       |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| App access                                                                    | Login required. Provide a stable **non-production** reviewer tenant with credentials, MFA bypass procedure, and a flow that reaches purchase without real payment (license-tester account). Reviewer access must not be the only route to advertised features                                                                     |
| Ads                                                                           | No ads                                                                                                                                                                                                                                                                                                                            |
| Content rating (IARC)                                                         | Business/productivity utility; no user-generated public chat, no gambling, no violence. Answer the questionnaire truthfully; guests view restaurant menus only                                                                                                                                                                    |
| Target audience                                                               | 18+ (restaurant operators). **Not** designed for children; do not enrol in Families                                                                                                                                                                                                                                               |
| News app / COVID / government / health                                        | No                                                                                                                                                                                                                                                                                                                                |
| Financial features                                                            | Verify wording: MenuMinute records orders and POS tenders for restaurants but does not itself provide lending, banking, crypto or investment services. Declare "My app doesn't provide any financial features" only after counsel confirms the POS/payment-recording scope                                                        |
| Data safety                                                                   | See `data-safety.md`                                                                                                                                                                                                                                                                                                              |
| Government/health/VPN/accessibility-service declarations                      | Not applicable (no such APIs)                                                                                                                                                                                                                                                                                                     |
| Permissions                                                                   | Source manifest requests `INTERNET` only; the billing library may merge `com.android.vending.BILLING` — confirm in the merged manifest of the signed build (not verified locally). No SMS, call log, location, camera, contacts or background-location permissions. Web Bluetooth is a browser permission prompted on user action |
| Exact alarms / full-screen intents / foreground services / photo-video access | None declared                                                                                                                                                                                                                                                                                                                     |

## 4. Technical quality

| Requirement                                                    | Status                                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Target API within Play's current requirement                   | **[Repo]** `targetSdk 36`. Re-check Play's current minimum before each release                                                                                           |
| 64-bit                                                         | **[Repo]** no native libraries                                                                                                                                           |
| Android App Bundle                                             | **[Repo]** `:app:bundleRelease`, signed only by the protected `android-play-internal` workflow                                                                           |
| Play App Signing + Digital Asset Links                         | **[Console] [Repo]** `ANDROID_PLAY_APP_SIGNING_SHA256`; `/.well-known/assetlinks.json` must return 200 before testing. A TWA without verified links shows browser chrome |
| Pre-launch report (Robo/stability/accessibility)               | **[Console]** review before promoting beyond internal testing                                                                                                            |
| Android vitals (crash/ANR) thresholds                          | **[Console]** monitor after staged rollout                                                                                                                               |
| Closed-testing requirement for new personal developer accounts | **[Console]** check your account type's current requirement before production access                                                                                     |
| Developer identity/contact details verified                    | **[Console]** legal developer name must match store-listing text ("BabaBuilds"?)                                                                                         |

## 5. Store listing

- Title ≤ 30 characters; short description ≤ 80; full description ≤ 4000. Keep claims to features present in the build;
  claim Bluetooth Classic/USB printing only for printer models recorded as passed in the device matrix (`README.md` §E, `print-bridge.md`). Declare the Bluetooth permission use in Play Console.
- Replace "This Play edition does not sell subscriptions in the app" (removed from `store-listing.md`): the listing now
  discloses that paid plans are available through Google Play.
- Screenshots must be real device captures of the signed build; no price or competitor claims that the app cannot back.
- Support email `admin@bababuilds.com`, website, and privacy URL must be live.

## 6. Release gates (all required)

1. `pnpm lint && pnpm typecheck && pnpm test` green on the exact SHA; Android CI lane green.
2. Migration `0111` applied through the normal pipeline; env validated.
3. Play billing verification checklist in `play-billing.md` passed on physical devices.
4. Device matrix in `device-test-matrix.md` passed.
5. Data safety, content rating, app access and target audience submitted and matching the build.
6. Operator sign-off recorded; staged rollout with Android vitals and billing logs monitored.
