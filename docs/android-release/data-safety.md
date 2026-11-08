# Data Safety and Play Console inputs — review draft

The Data Safety form is not safe to auto-submit. Confirm live environments and all actual SDK/data transfers first.

| Data category                   | Likely product collection                                       | Purpose                                                     |
| ------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------- |
| Name/email/account identifiers  | Merchant and team accounts                                      | Authentication, customer support, security                  |
| Phone number                    | Optional merchant and guest CRM                                 | Guest lookup and permitted communication                    |
| Order and purchase history      | Restaurant orders and payments                                  | POS/restaurant functionality, service evidence              |
| Files/photos                    | Merchant menu image upload                                      | Menu creation and optional AI interpretation                |
| Device IDs/session data         | Auth/session security, possible Web Push endpoints              | Protect session, optional alerts                            |
| Diagnostics                     | Service/HTTP logs                                               | Security, reliability, abuse detection                      |
| Bluetooth peripherals           | Browser BLE pairing by user action                              | Local printer selection and receipt transfer                |
| Purchase history (subscription) | Google Play purchase token, order id, plan, renewal date, state | Verify and manage the merchant's paid plan with Google Play |

Payments: subscriptions in the Play app are processed by **Google Play Billing**; MenuMinute never receives card, UPI or Google payment-method details, only the purchase token, order id and subscription state used to verify entitlement. Declare "Purchase history" under Financial info as collected, **not shared**, required for app functionality, with a deletion/retention answer matching `docs/account-deletion-requests.md` (billing records are retained where law requires). Razorpay applies to web checkout only and is not used inside the Play app.

Review Cloudflare, VPS, email, analytics, AI provider integrations, Google OAuth, payment providers and any native package dependencies for collection/sharing declarations. Do not infer that 'no SDK' means 'no collection': TWA serves the live web app.

User deletion: `https://food.bababuilds.com/delete-account`.
Privacy policy: `https://food.bababuilds.com/privacy`.
Account deletion operations: `docs/account-deletion-requests.md`.

Play console forms must be signed off against the exact live distribution and relevant country/region rules.
