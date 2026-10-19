# Auth 2.0 — verified identity and recovery rollout (PR A)

## Gate

Do not activate this release on public production until `EMAIL_PROVIDER=resend`,
`EMAIL_FROM` is a verified Resend sender, and `RESEND_API_KEY` is installed in the private
web environment. No credentials or one-time links belong in GitHub, logs or Action summaries.
The environment validator refuses unconfigured production delivery.

## Existing accounts

This migration does **not** backfill `email_verified=true`, delete accounts, or rotate old
passwords/QR identities. Before activation inventory `users.email_verified` and active
membership counts. Notify existing owners using independently verified contact information.
An existing unverified user may request another verification message from /verify-email; after
verification they can log in using the old credential. Keep a documented, identity-checked
manual recovery process for addresses no longer controlled by an owner. Never bulk-verify
legacy users to make rollout green.

## New accounts

Better Auth sends 1-hour single-use verification links; no session is created at signup;
verified email is required to log in. The DB trigger also guards new/changed effective
organization memberships, including direct provisioning. Password-reset links last 30 minutes;
successful reset revokes existing sessions, using transactional PostgreSQL auth storage.
Resend transport is fail-closed and never logs bearer tokens or generated links.

## Isolated tests

`EMAIL_PROVIDER=test AUTH_ALLOW_TEST_EMAIL=true` is accepted only with
`APP_URL` hostname `localhost` and database path `/menuminute_test`. The in-process
sink is never available on the public hostname and never logs tokens. Test fixtures must
explicitly mark _synthetic_ identities verified; do not reproduce that behavior in production.

## Rollback

Prior to new writes, release rollback may restore old code. Do not reverse the immutable
verified state or drop the membership trigger while the new account policy is in use.
Recover using a reviewed forward migration if activation fails after writes.

## Fail-closed merge-to-activation gate

Code may be merged and the signed ARM64 artifact staged before production cutover.
The deployment workflow does **not** run automatic eligibility or production activation
until the repository Actions variable `AUTH_V2_CUTOVER_APPROVED` is explicitly set to
`verified-identity-mfa-2026-10`. This is an operator sign-off, **not a credential**.
Do not set it until all of the following are verified using the private root-owned
production environment (no secrets printed in CI):

1. `EMAIL_PROVIDER=resend`, a verified Resend `EMAIL_FROM` and working
   `RESEND_API_KEY`; send and complete a real verification and password-reset email.
2. Inventory existing unverified owner/admin addresses and their currently active
   memberships. Notify them and confirm an independently identity-checked recovery
   route; do not mark legacy addresses verified as a shortcut.
3. Rehearse additive migrations 0007 and 0008 against a current disposable backup and
   perform both invalid-token and valid-token acceptance checks.
4. Confirm MFA enrollment/recovery and signed-in step-up on the real production hostname;
   if enabling Cloudflare Turnstile, provide both matching private and public keys,
   including the public value at build time.
5. Record the current release SHA and rollback decision. After approval, set the Actions
   variable and explicitly dispatch the existing deploy workflow for the verified
   published main SHA with `activate=true`. A past staged run never authorizes itself.

This gate prevents unattended cutover, not CI, merge or artifact staging. Leave the
variable unset after a failed rehearsal or if private production configuration cannot be
inspected. An older pre-gate deploy workflow run must not be manually re-run as a bypass.
