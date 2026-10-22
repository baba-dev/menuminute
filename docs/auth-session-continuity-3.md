# Authentication 3.0 — session continuity / rollout

Scope: PR A and PR B only. No auth provider replacement, schema change, cross-domain
cookie sharing, production secret rotation or admin/MFA weakening.

## Mechanism

Better Auth remains the source of truth: signed HttpOnly first-party cookie, live
PostgreSQL sessions, cookie cache disabled. `rememberMe: true` opts into a 30-day
sliding database session and persistent cookie; `rememberMe: false` uses the
library's non-persistent browser-session cookie and does not persist an account hint.
The browser hint, when enabled, stores **only an email** after completed sign-in
(including a successful two-factor challenge). It never authorizes anything.

Server Component / shared `auth()` reads call `getSession` with `disableRefresh: true`:
they verify the user and DB record without consuming the rolling-renewal window
or attempting to forward Set-Cookie headers from a read-only render. The private dashboard, admin,
account/security and onboarding mount an unobtrusive browser-side GET to the
same-origin Better Auth get-session endpoint on mount, focus, online/visibility
events (at most once/minute) and every four hours while visible. Only the library
refreshes its signed cookie. A failed request never causes client-side sign-out.
A separate server check always gates protected pages and writes.

The public marketing page stays statically rendered: a small client component
requests session status for account actions, with a neutral loading state. The
login server page validates the actual session, redirects to a vetted destination,
onboarding or dashboard, or offers an explicit, server-authorized switch-account
action. No cookie-existence or localStorage shortcut is an authentication check.
Password reset continues to revoke existing sessions. MFA and privileged step-up
remain unchanged.

## Deployment/preflight — MUST be verified on the actual host

The repository cannot inspect the operator's private VPS environment or prove a
live browser cookie survives a deployment. Do not report these as completed by CI.

1. Candidate artifact runs the root-owned external `/etc/menuminute/web.env`;
   verify the installed systemd web unit references the same file before/after
   symlink cutover. **Do not rotate AUTH_SECRET** in this release. Never print,
   paste, commit or send the value/fingerprint. The worker must not receive it.
2. Run the read-only private diagnostic as the web service identity under its
   EnvironmentFile: `node dist/auth-session-preflight.mjs`. It checks canonical
   origin, session policy, PostgreSQL connectivity and session schema without
   exposing rows. A failed preflight blocks activation.
3. Confirm APP_URL is the exact public HTTPS origin, the deployed Nginx host
   forwards Host/X-Forwarded-Host and overwrites X-Forwarded-Proto with the trusted
   HTTPS scheme. Use Cloudflare **Full (strict)** and bypass caching on
   `/api/auth/*`, `/dashboard/*`, `/account/*`, `/admin/*`.
   Preserve all upstream Set-Cookie headers. Review the committed Nginx example;
   updating that example does NOT install the production config.
4. In an authenticated browser, inspect network headers privately: a remembered
   sign-in cookie has Secure, HttpOnly, SameSite=Lax and a 30-day Max-Age; an
   unchecked Remember Me sign-in has a browser-session cookie. After the update
   interval, GET `/api/auth/get-session` must deliver a renewed Set-Cookie,
   including behind Cloudflare. Do not share the cookie/header value.
5. Check a controlled **test** account through reload, browser restart, a
   `menuminute-web` service restart and one immutable release cutover; it must
   remain signed in, with the same authorized outlet. Verify revoked sessions
   cannot be used and a temporary 503/offline event is not described as expiry.
6. Preserve the existing release helper backup, ERP readiness, CI and migration
   guards. No new SQL migrations are needed for this change.

Local: `pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`.
Required remote evidence: all four native ARM64 CI lanes + exact-head gate, with
two viewport Chromium browser checks. Production confirmation requires the
separate private host/browser checks above, not just a successful source PR.
