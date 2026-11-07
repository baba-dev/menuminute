# Data Safety and Play Console inputs — review draft

The Data Safety form is not safe to auto-submit. Confirm live environments and all actual SDK/data transfers first.

| Data category | Likely product collection | Purpose |
| --- | --- | --- |
| Name/email/account identifiers | Merchant and team accounts | Authentication, customer support, security |
| Phone number | Optional merchant and guest CRM | Guest lookup and permitted communication |
| Order and purchase history | Restaurant orders and payments | POS/restaurant functionality, service evidence |
| Files/photos | Merchant menu image upload | Menu creation and optional AI interpretation |
| Device IDs/session data | Auth/session security, possible Web Push endpoints | Protect session, optional alerts |
| Diagnostics | Service/HTTP logs | Security, reliability, abuse detection |
| Bluetooth peripherals | Browser BLE pairing by user action | Local printer selection and receipt transfer |

Review Cloudflare, VPS, email, analytics, AI provider integrations, Google OAuth, payment providers and any native package dependencies for collection/sharing declarations. Do not infer that 'no SDK' means 'no collection': TWA serves the live web app.

User deletion: `https://food.bababuilds.com/delete-account`.
Privacy policy: `https://food.bababuilds.com/privacy`.
Account deletion operations: `docs/account-deletion-requests.md`.

Play console forms must be signed off against the exact live distribution and relevant country/region rules.
