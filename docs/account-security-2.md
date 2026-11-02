# Account Security 2.0 — rollout and recovery

Account Security is now a personal workspace at /account/security, using the same dashboard shell as /account and Organization. Email/password login and the existing Better Auth TOTP plugin are retained.

## Deployment order

1. Run the existing full CI suite and browser tests including account-security-v2, auth-mfa, and security regressions. This PR has no new database schema and needs no migration.
2. Deploy without Google keys first. Verify normal email/password login, password reset, security page access for an account with **no outlet**, MFA enrollment and recovery, privileged confirmation, and device revocation.
3. To enable linked Google sign-in, configure **both** GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in the root-only web environment. Register the exact Google OAuth authorized redirect URI: https://food.bababuilds.com/api/auth/callback/google. Enable the provider for the correct Google OAuth consent screen. Keep secrets out of NEXT_PUBLIC_*, Git, logs and build archives.
4. Restart menuminute-web using the standard immutable release procedure. No worker restart is needed for OAuth configuration. Verify the sign-in button only appears with both keys; it must remain absent without them.
5. With a verified existing password-based account **without TOTP**, connect Google explicitly from Account Security. Sign out, use Google to sign in, and verify the same account, organizations and outlets remain available. Test disconnect and retained password sign-in. A fresh Google identity must not silently sign up or attach by matching email alone.
6. Exercise the MFA safety boundary: an authenticator-enabled account must NOT be able to log in with Google until an independently challenged OAuth session flow is available. Password + TOTP must continue to work. Do not disable this guard in order to make Google OAuth work.
7. Exercise browser back/forward, dark/light theme, small mobile width, and accessibility (labels, focus, screen readers). Monitor auth errors and device events after release.

## Important behavioral limits

- Google is **linked-account login**, not open Google registration. New users register with verified email and password first; this preserves versioned legal-consent collection and prevents unverified same-email takeover.
- TOTP is enforced by Better Auth on credential sign-ins only. The Google security gate fails closed for accounts with TOTP. Users can choose password + authenticator instead. A follow-up implementation with secure OAuth second-factor enforcement can lift this restriction.
- Existing 2FA recovery codes can be regenerated only after password verification. Regeneration invalidates older codes. A lost authenticator requires an existing recovery code or a separately audited recovery process.
- The existing privileged step-up proof remains five minutes and single-use; it is not replaced by social login.
- This workspace never shows access tokens, OAuth credentials, or raw stored password hashes.
- Security events retain their existing backend audit source. The page shows only the most recent 30 events with five rows per page.

## Rollback

Unset the two GOOGLE_* variables to disable social sign-in while keeping email/password access. To roll back the UI, deploy the previous immutable release; account, session, and MFA tables remain compatible. **Before rollback**, review users who have linked Google and ensure their password method still works; do not unlink accounts or delete recovery data as part of rollback.
