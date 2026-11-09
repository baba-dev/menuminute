# Google Play review account: The Droid Pie

This is a **separate, opt-in, non-production-data tenant in the production database** for Google Play app reviewers. It is a regular Better Auth email/password account with an owner role on one isolated restaurant, *not* the public demo actor; the public demo guard and automatic 30-minute reset do not apply.

**Account display name:** Reviewer Account

**Eatery:** The Droid Pie

**Capabilities:** Published QR/menu with illustrated dishes and variants, 10 tables, 3 kitchen stations and routing, ordering and Kitchen review entitlements (non-billable), automatically enabled standard POS, sample 30-day order history with a live board, sample reservations, guest CRM, outlet settings, and menu editing. The reviewer can create fresh orders and exercise permitted merchant workflows.

**Explicit limits:** This does not create real provider payments, fiscal invoices, guaranteed AI provider availability, physical BLE printer compatibility, a real Google Play purchase, or an admin-only account. Those have their normal production gates. Order/customer details are synthetic. It does not disable ordinary tenant RBAC, subscriptions or payment security.

## Security rules

- Do **not** put reviewer email/password in source files, GitHub commits, PRs, CI logs, chat messages, or root runtime web environment. If any credential was previously shared, **rotate it before reviewer use**.
- Use an owner-controlled reviewer mailbox (e.g. a private alias under a domain you control). Provide credentials only through Play Console's App access form. Do not use the public demo mailbox.
- Never seed the reviewer automatically on `main` merge or from a web request. Provision once using a console command requiring an explicit opt-in and the root-only migration-owner connection.
- The normal web and worker services must never receive `PLAY_REVIEWER_PASSWORD` or `MIGRATION_DATABASE_URL`.
- The provisioner refuses collisions with unrelated users/tenants, uses a single transaction, and preserves reviewer-modified records on reruns. Default reruns do **not** change the password. Set `PLAY_REVIEWER_ROTATE_PASSWORD=true` only when intentionally rotating it.
- Do not make the review account a platform superadmin. The organization has MFA optional so Google can sign in; security-sensitive operations requiring step-up authentication are still unavailable without that step-up.

## One-time owner action on the production VPS (after PR CI + deployment)

Create a private env file with *only* these values, as root:

```bash
sudo install -m 600 -o root -g root /dev/null /etc/menuminute/play-reviewer.env
sudo nano /etc/menuminute/play-reviewer.env
```

Enter:

```dotenv
ALLOW_PLAY_REVIEW_PROVISION=true
APP_URL=https://food.bababuilds.com
PLAY_REVIEWER_EMAIL=YOUR_OWN_CONTROLLED_MAILBOX
PLAY_REVIEWER_PASSWORD=YOUR_NEW_LONG_RANDOM_PRIVATE_PASSWORD
```

The script requires a 16–128 character password and an existing owner-controlled mailbox. Do not reuse a password that was pasted into a chat. Use a password manager and don't send credentials to maintainers or the repository.

Check the pre-existing, root-only `/etc/menuminute/migration.env` is present (the normal deployment already uses it to perform reviewed database migrations). **Do not paste its contents anywhere**. Confirm your current release has `dist/play-reviewer-provision.mjs`.

From the VPS, invoke this root-controlled, one-time command:

```bash
sudo bash -c '
set -Eeuo pipefail
umask 077
set -a
source /etc/menuminute/migration.env
source /etc/menuminute/play-reviewer.env
set +a
cd /var/www/menuminute/current
exec /opt/menuminute/node24/bin/node dist/play-reviewer-provision.mjs
'
```

It outputs only a summary of seeded menu dishes, orders and tables — no email, password, token or DB URL. It does **not** run as part of GitHub CI or the live website's HTTP request path. After successful provisioning, remove the one-time env file:

```bash
sudo shred --remove /etc/menuminute/play-reviewer.env
```

(Note: file shredding on SSDs/journaling filesystems is not a guaranteed secure-erasure mechanism; treat the environment file's storage and backups as sensitive.)

### Password rotation later

Re-create the root-only env file with the **same email** and a *new* password plus `PLAY_REVIEWER_ROTATE_PASSWORD=true`, then re-run. That updates the Better Auth credential hash only. Existing sessions are not implicitly revoked; revoke them in account security if rotating due to suspected compromise. Do not edit raw hashed credentials manually.

## Play Console reviewer-access form

- **Access:** Some or all functionality restricted
- **Login method:** Email and password
- **Username:** the private address from `PLAY_REVIEWER_EMAIL` (not the display name)
- **Password:** the private new password you configured
- **MFA / OTP:** None for this reviewer tenant
- **Restaurant:** The Droid Pie
- **Entry:** launch Android app; login; navigate to Dashboard / Menu Studio / Orders / POS / Kitchen / Reservations / Guests / QR
- **Network:** required for all live actions
- **Paid plans:** functionality enabled via operator-created, non-billable review grants, not simulated provider purchases
- **Notes:** all entries are fictional, sample amounts are not real financial transactions, and irreversible actions should be avoided.

If Play review cannot see a feature, verify the per-feature flags and releases; **do not claim untested provider features work**. The script does not override global AI, payment, fiscal or account-security gates.

For real-world acceptance, test a login from a clean Android TWA session, menu publication, QR link, POS receipt fallback, Kitchen board, active orders, reservations, guest CRM and logout. Use `docs/android-release/device-test-matrix.md` to record results.
