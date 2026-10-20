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

## Automatic merge-to-activation (migration-lineage repair)

Merging a release into main triggers the four-lane CI, immutable native ARM64 publication,
and a single unattended deployment chain. The deployment verifies the published SHA
and checksum, stages the artifact on the VPS, runs the root helper's eligibility
check, and then automatically activates and publicly verifies the **latest main**.
Manual workflow dispatch takes the full published latest-main SHA and also activates;
there is no approval variable or stage-only checkbox. The production environment
is labelled successful only after web, worker, PostgreSQL, both Redis connections,
ERP, public readiness and routes are checked. Failed eligibility fails the run.

The prior production release `caa91318f6e6dc3827b8709ee8f9e6ea8990ba59`
already applied `0009_menu_import_foundation` as journal index 7. Its SQL and
metadata are immutable. The lineage repair keeps it at index 7, then appends
`0007_verified_identity`, `0008_auth_security`, and
`0010_menu_import_nvidia_engine`, then `0011_menu_import_review`. The numeric SQL filenames are historical;
`meta/_journal.json` determines execution order. Never insert new journal
entries ahead of one already deployed, even if the filename number is smaller.
`tests/deploy/migration-policy.py` checks this exact historical case.

**Release prerequisites** remain mandatory and should be validated before merging
account-lifecycle changes: private production Resend configuration, verified sender,
live verification/reset-email tests, existing unverified-owner inventory and
identity-checked recovery, Auth 2.0 migration rehearsal against a disposable
backup, MFA enrollment/recovery/step-up on the production hostname, and matching
Turnstile keys if enabled. Do not bulk-verify existing users.

The root-owned helper v4 still refuses divergent applied migration histories,
unhealthy services, missing migration-owner configuration, unsuccessful off-host
backup, or failed ERP preflight. Do not disable these checks to make a deploy green.
If the new auth release fails runtime configuration or migration, repair that
specific issue and deploy a new tested commit instead of force-activating or
re-running an older workflow. Rollback of irreversible migrations must not
destroy new data or silently downgrade schema.
