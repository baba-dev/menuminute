# Auth 2.0 — PR B release and operations

PR B is based on PR A; merge A first after email delivery and CI are verified. Do not
merge or activate B without the full combined CI, migration rehearsal, and an actual
browser-based authenticator enrollment/sign-in/recovery/step-up acceptance pass.

## MFA enforcement

New organizations default to `mfa_required=true`. Existing organizations are
grandfathered as false to avoid an unannounced lockout; inventory and notify verified
owners, ask them to enroll, and flip the flag in a reviewed per-organization rollout.
Owner/admin protected API requests and dashboard entry are blocked until enrollment.
Account security remains accessible so enrollment can complete.
Ownership transfer and promotion to organization admin require a password plus native
TOTP check, a current active DB session, and a five-minute single-use proof checked
and consumed inside the authoritative SQL command. The native plugin owns enrollment,
TOTP, sign-in challenges, encrypted backup codes and recovery.

## Infra and abuse controls

Set `TURNSTILE_SECRET_KEY` in the private web environment; inject matching
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` **at build time**. Test the real challenge on the public
hostname; do not enable just one half. Better Auth handles server validation on signup.
Application auth budgets use Redis, hashed normalized email plus a proxy-overwritten
X-Real-IP; preserve the existing Better Auth DB limits and restrict origin access to
trusted Cloudflare/Nginx proxy addresses. Never trust an arbitrary forwarded client IP.
No provider secrets or MFA QR/backup values may be logged or placed in source.

CSP intentionally permits Next.js/theme inline bootstrapping; base-uri, frame, object and
form boundaries are enforced. Tighten script-src to nonce/hash-based bootstrap after
testing Next.js hydration and third-party challenge loading.

## Turnstile immutable release rollout

1. Create a Cloudflare Turnstile widget restricted to `food.bababuilds.com`. Save its **site key** in the repository's GitHub Actions **variable** named `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (Settings → Secrets and variables → Actions → Variables). This key is public; do not put it in the private GitHub Actions secrets. CI injects it only into the production ARM64 `pnpm build` that is subsequently browser-tested and packaged. The isolated Ember-only build deliberately does not inject the live-domain key.
2. Build and activate a verified release that contains the site key **before** enabling the server-side challenge. Browser tests stub only the external Turnstile client in their localhost fixture, with no server-side Turnstile secret; this is not evidence that Cloudflare production verification works.
3. Store the matching **secret key** only as `TURNSTILE_SECRET_KEY` in root-protected `/etc/menuminute/web.env`. Never put this secret in GitHub Variables/Secrets, `NEXT_PUBLIC_*`, a release archive or worker.env. Restart **only** `menuminute-web` after the matching release is active.
4. Verify real registration on `https://food.bababuilds.com/register`: challenge renders, a valid solved challenge permits signup, an absent/invalid challenge is rejected, verification mail arrives, and existing login/password-reset routes still work. Watch errors and have a documented operator rollback for the secret if Cloudflare challenges fail.
5. Changing the GitHub site-key variable requires a **new immutable build and deployment**; changing only the VPS environment cannot replace a compiled public key. Missing variable keeps the widget absent. Do not activate the server-side challenge when the release lacks a working site key.

## Audit and backout

Security event rows record event kind, user ID, session ID and timestamp without secrets.
Successful reset and privileged confirmation send verified-address alerts without
blocking account recovery if the alert transport is down. Operational tests must cover
rate-limit Redis failure, TOTP wrong/replay cases, recovery codes, all-device logout,
expired proof and multi-tab behavior. Legacy organizations continue normal operations
until their per-org flag is explicitly enabled. Never backfill `two_factor_enabled` for
real accounts without a verified authenticator enrollment.
