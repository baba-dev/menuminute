# Demo Kitchen ticket freshness — operator readiness

The public demo is explicitly opt-in. Its web and worker processes read **different** systemd environment files. An enabled web demo with a disabled worker leaves seeded Kitchen tickets aging indefinitely even while the browser countdown says the next reset is in 30 minutes.

## Required configuration

In the private root-controlled runtime files, set exactly the same `DEMO_MODE_ENABLED` value:

- `/etc/menuminute/web.env` — `DEMO_MODE_ENABLED=true`
- `/etc/menuminute/worker.env` — `DEMO_MODE_ENABLED=true`

Do not copy the web environment file into the worker (it contains credentials and application secrets the worker must not have). Use only the single flag. The release preflight rejects mismatches before database migrations and before production symlink activation. Both services can also be explicitly disabled with `false`.

## Verification

After a successful deployment and worker restart:

1. Check the restricted worker service is active: `sudo systemctl is-active menuminute-worker.service`.
2. Review structured reset messages with `sudo journalctl -u menuminute-worker.service --since '15 minutes ago' --no-pager`; look for `demo.reset.scheduler`, `demo.reset.succeeded`, or `demo.reset.failed`. Do not paste private environment files into support requests.
3. Enter the public demo and inspect `/kitchen`. The oldest queued/preparing ticket should be under ~60 minutes; a fresh reset typically yields items aged 2–42 minutes.
4. Observe another half-hour boundary and refresh. The worker should report a new successful reset and the Kitchen should show fresh tickets.

On failure, the worker retries in 1–5 minutes with redacted diagnostics. The browser countdown alone is not evidence that a reset actually occurred. The new database health function checks the fixed demo outlet only and is executable solely by the restricted worker. Real-tenant orders, billing, POS, audits and entitlements are never reset by this procedure.

If a demo reset is failing, inspect only the structured error code and the latest database migration status. Do **not** manually delete Kitchen tickets, disable integrity checks, or run the demo reset with a web or migration-owner runtime credential.
