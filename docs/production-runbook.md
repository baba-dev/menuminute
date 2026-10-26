# Production deployment and recovery — Oracle ARM64

Last operator evidence: **2026-10-16**. This is the canonical account of the **deployed host**; `docs/deployment.md` describes the architecture and `docs/deployment-actions.md` describes the optional subsequent GitHub Actions deployment mechanism. These are not interchangeable. Update this document and the dated evidence after any host change. Never commit secrets or paste environment-file contents into tickets.

## Current status: facts versus outstanding gates

- Production origin: `https://food.bababuilds.com` behind Cloudflare proxy. Public homepage and `/api/health/ready` returned HTTP 200 with TLS verification 0; response was Cloudflare DYNAMIC. Cloudflare Origin CA certificate on the host matches `*.bababuilds.com` and `bababuilds.com`, valid until August 2040. Keep DNS proxied and SSL/TLS **Full (strict)**; this origin certificate is not a normal publicly trusted direct-origin certificate.
- First manually activated application artifact: release tag `arm64-a259f77c559d`, full SHA `a259f77c559da6b79f35de0b4ca42ef679840b8d`; web/worker active, enabled at boot, readiness database=true/queue=true/cache=true, original signup completed, ERP HTTP 200 after Nginx reload.
- Both separate Unix identities successfully performed a temporary original -> Sharp 0.34.5 WebP display/thumbnail -> cross-account read with files mode 0660. One completed outbox event was observed. **The real authenticated image-upload -> SQL outbox -> Redis -> worker -> ready -> approval/public menu and QR flow was not yet confirmed**; at the last query `dish_media` had zero rows.
- Four reported encrypted R2 recovery snapshots: `d34bc7fd` baseline, `b15886c2` pre-migration, `56d74aa4` post-six-migration, `a9e93de1` configuration. A nightly backup script/service/timer was proposed later, but installation, execution, restore with live customer data, pruning and external alerting **have not been confirmed**. Do not call those gates passed.
- Repository `main` can move ahead of the **deployed** SHA. A successful PR merge or published ARM64 artifact is not enough by itself: the automatic path activates only the latest verified main release after the production environment gate, VPS checks and unchanged-migration guard pass. Check the two live symlinks before reporting the deployed version.

## 2026-10-16 failed cutover containment (operator verification required)

An attempted Actions activation of staged SHA `a74adfe4f6a24648e90e953090afb6ee4dabf2df`
failed at 17:20 UTC: both MenuMinute units exited `200/CHDIR` with
`Permission denied` on their `WorkingDirectory`. The original staging helper
used `umask 027`, publishing root:root release directories without the traverse
permission required by the separate web/worker service users. The helper restored
both links to `a259f77c559da6b79f35de0b4ca42ef679840b8d`, but five
failed starts had exhausted systemd `StartLimitBurst`, preventing the rollback
restart. ERP remained HTTP 200. **Do not assume MenuMinute service recovery
until fresh readiness is reported.**

First verify both live pointers target the previous release, then run
`systemctl reset-failed menuminute-web.service menuminute-worker.service` and
`systemctl start menuminute-web.service menuminute-worker.service`; verify both
active, loopback readiness and ERP 200. Do not change ERP, flush Redis, run DB
migrations or re-trigger activation to recover this failure.

The corrected helper normalizes root-owned published code/assets to readable
`0755` directories / `0644` ordinary files (retaining required executable
bits and not following the persistent cache symlink), checks actual service-user
directory traversal and entry-point readability before changing either live
link, and clears the two MenuMinute systemd start-rate-limit failures before
attempting rollback. Existing staged SHA directories are not silently rewritten.
A qualified operator must repair the permissions on the **exact verified staged
release** and confirm both service-user checks before authorizing another
cutover. Keep root-only environment files under `/etc/menuminute` private.

## Host map and immutable boundaries

| Purpose                        | Production host path / identity                                                                                    | Contract                                                                                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Existing ERP                   | `erp.bababuilds.com`; PM2 `erp` under root; `/var/www/bababuilds-erp`; port 3000; `/usr/bin/node` Node 20          | Never upgrade/restart/modify as a side effect; HTTP 200 before and after all changes                                          |
| MenuMinute origin              | `food.bababuilds.com` -> Cloudflare -> Nginx -> `127.0.0.1:3100`                                                   | No direct public listener on 3100                                                                                             |
| Private Node runtime           | `/opt/menuminute/node-v24.22.0` via `/opt/menuminute/node24/bin/node`                                              | Do not replace `/usr/bin/node`                                                                                                |
| Releases                       | `/var/www/menuminute/releases/<full-40-char-sha>`                                                                  | Root-owned immutable runtime; never build on VPS                                                                              |
| Active web and worker          | `/var/www/menuminute/current` and `/var/www/menuminute/worker-current`                                             | Both symlinks must point to the same verified compatible SHA                                                                  |
| Standalone app                 | `<release>/.next/standalone/server.js` with public/static assets; port 3100                                        | Unit `menuminute-web.service`, user `menuminute`                                                                              |
| Worker                         | `<release>/dist/worker.mjs` plus production node_modules                                                           | Unit `menuminute-worker.service`, user `menuminute-worker`                                                                    |
| Migration                      | `<release>/dist/db-migrate.mjs` and `<release>/src/db/migrations`                                                  | Migration owner only, explicitly operator-approved, not automatic on deployment                                               |
| Web/worker secrets             | `/etc/menuminute/web.env`; `/etc/menuminute/worker.env`                                                            | Root:root 0600; do not put in release, log or repository                                                                      |
| Provisioned connection secrets | `/etc/menuminute/{migration-db,web-db,worker-db,redis-queue,redis-cache}.env`                                      | Existing initial-provisioning files; do not assume fixed Redis ACL usernames; migration ownership distinct from runtime roles |
| Shared local media             | `/var/lib/menuminute/media`                                                                                        | Root:menuminute-media 2770; both users supplementary group; directories 2770/files 0660; originals and derivatives private    |
| Private runtime state          | `/var/lib/menuminute/cache`, `tmp`, `worker-tmp`                                                                   | Web/worker-specific writable mounts; Next standalone `.next/cache` links to persistent cache                                  |
| Nginx host                     | `/etc/nginx/conf.d/food.bababuilds.com.conf`                                                                       | Separate Food virtual host; do not overwrite existing ERP/default sites                                                       |
| Existing TLS                   | `/etc/nginx/certs/pubkey-bababuilds.pem` and `privkey-bababuilds.key`                                              | Shared wildcard Cloudflare Origin CA certificate/key; never print key                                                         |
| Backups                        | `/usr/local/sbin/menuminute-restic`, `/etc/menuminute/backup/{r2.json,restic-password}`, `/var/backups/menuminute` | Root-only private R2 restic repository; **R2 is backup storage, NOT live media**                                              |
| Optional deploy handoff        | `/var/lib/menuminute/incoming`; `/usr/local/sbin/menuminute-release`; `/etc/menuminute/approved-releases/<SHA>`    | Only once independently provisioned; see Actions deploy runbook                                                               |

PostgreSQL 17 is private on `127.0.0.1:5432`; database `menuminute` with independent `menuminute_owner`, `menuminute_app` and `menuminute_worker` roles. Actual migration ledger contains six named checksummed migrations `0000`–`0005`. Redis 8 queue is private at `127.0.0.1:6381` (128 MiB, AOF, noeviction); cache at `127.0.0.1:6382` (64 MiB, volatile, allkeys-lru). **CI's 6379/6380 ports and synthetic secrets are not production values.** Runtime web and worker read disjoint environment files. Do not grant the worker auth/migration credentials, or either service write access to root-owned releases.

The source systemd templates use `/usr/bin/node` as an initial placeholder; the **installed** units use the isolated Node 24 executable. Compare installed units before any update. Service budget: web MemoryHigh 768M/MemoryMax 1G/CPUQuota 150%; worker 192M/256M/50%; both `ProtectSystem=strict`, `UMask=0007`, limited `ReadWritePaths`. The worker dispatches durable PostgreSQL events to Redis; cache Redis is neither authorization nor durable state.

## Release channels and agent/operator responsibilities

1. Agent creates a scoped PR from current `main`, documents migration compatibility and rollback, runs tests, and **does not use production credentials or the VPS for CI**.
2. All four native `ubuntu-24.04-arm` checks plus their aggregate quality gate must pass on the final PR SHA: Lint & Code Style; TypeScript Strict Typecheck; PostgreSQL & Redis Integration; Production Build & Browser. Do not merge a predecessor SHA's green checks.
3. A successful **push-to-main CI** packages the tested production build once and allows `.github/workflows/publish-arm64.yml` to publish `arm64-<first-12-sha>` with a native ARM64 archive and adjacent SHA-256 file. Successful same-repository main publisher completion triggers automatic checksum-verified staging and, when the candidate is still the latest `main` and its migration tree exactly matches the running release, activation. PR-triggered packaging is only a smoke test. Migration-changing releases remain on the manual path; no workflow path runs SQL automatically.
4. **Manual first-install path** already used on the host: verify archive SHA-256 and embedded full commit, extract root-owned `releases/<SHA>`, validate production modules, link persistent cache, provision private Node/systemd/env, perform backup -> migration -> backup under migration-owner, then explicitly switch both links/start MenuMinute units. Do not repeat first-install steps destructively on an already-live host.
5. **Actions path:** `.github/workflows/deploy-vps.yml` accepts a successful main publisher `workflow_run` for verified automatic activation, or a manual `workflow_dispatch` on `main`; it separates `production-staging` from the URL-linked `production` activation environment, uses pinned SSH host identity, restricted `menuminute-deploy` account, a direct verified public GitHub HTTPS pull (no rsync), and root-installed `infra/deploy/menuminute-release`. Automatic activation fails closed on changed, unreadable or symlinked migration trees and does not create an approval marker. Manual `activate=true` with the root-owned per-SHA approval marker remains the path for reviewed migration changes and rollback. It never touches Nginx, ERP, or automatically applies/rolls back migrations. Review `docs/deployment-actions.md`; GitHub source changes are not themselves evidence of VPS installation.
6. **Manual-to-Actions handoff and failed first activation:** the initial live `a259f77...` release has no helper-issued `.release-archive-sha256` marker; never overwrite or invent one. Stage a distinct immutable SHA through the helper. The `a74adfe...` stage succeeded, but its first activation failed with `200/CHDIR`; the verified archive stayed intact, both pointers were restored to the original SHA, and the operator subsequently recovered both services. PR #32 fixed permission normalization, real runtime-user preflight and rollback start-limit handling. The operator installed that root-owned helper from pinned `364f3a5...`, verified/normalized only staged `a74adfe...`, confirmed web and worker user access, reran idempotent stage, and reported web/worker active, readiness healthy and ERP 200. Approval was revoked: do not infer that a new activation succeeded.
7. Before automatic activation: full SHA/tag/checksum/source verification; current ERP 200; MenuMinute loopback readiness 200; adequate disk/ERP headroom; and an unchanged migration tree are required. For a migration-changing or rollback release, additionally require an encrypted off-host backup and tested recovery point, additive/checksummed migration and compatibility review, operator approval, and manual SQL application with the migration owner before atomically switching matching web/worker symlinks and restarting **only** MenuMinute services.
8. After activation: `/api/health/live` 200, `/api/health/ready` 200 with database/queue/cache true, worker active, localhost listener only, public Cloudflare TLS 0 and ready 200, homepage/auth/tenant/media/QR smoke, ERP 200. Capture SHA, release/backup IDs, migration count and smoke outcome in release handoff.

Production changes to DNS/Cloudflare, certificate, Nginx, systemd, resource budgets, retention, security groups, or database schema require operator review independent of a docs PR. No agent may bypass that gate or treat a merged PR as a live deployment.

## Operator quick verification (no secret values)

```bash
readlink -f /var/www/menuminute/current
readlink -f /var/www/menuminute/worker-current
/opt/menuminute/node24/bin/node --version
/usr/bin/node --version # ERP's runtime must remain unchanged
systemctl is-active menuminute-web menuminute-worker
systemctl is-enabled menuminute-web menuminute-worker
ss -ltn '( sport = :3100 )'
curl -fsS --max-time 15 http://127.0.0.1:3100/api/health/ready
curl -fsS --max-time 20 https://food.bababuilds.com/api/health/ready
curl -fsS --max-time 15 -o /dev/null -w 'ERP %{http_code}\n' https://erp.bababuilds.com/
sudo -u postgres psql -X -d menuminute -c 'SELECT name, left(checksum,12) FROM drizzle.foundation_migrations ORDER BY name'
sudo nginx -t
```

Expected: two identical live release target paths, two healthy services, 127.0.0.1 listener, HTTPS ready status with database=true and two Redis booleans true, ERP 200, six checked migration records unless a later approved migration set is deployed. Public status checks do not demonstrate signup or the complete media workflow.

## Backup strategy, restore, and monitoring gates

Use the separate **private R2 restic repository** with wrapper `/usr/local/sbin/menuminute-restic` and off-box restic password plus R2 recovery keys. Capture a PostgreSQL custom-format dump (no owner/ACL), `/var/lib/menuminute/media`, app environment files (including the stable `AUTH_SECRET`), service/Nginx configuration and the live SHA. Protect all staging files mode 0700 and delete temporary dump files after a successful backup. A plain `pg_dump` followed by a live filesystem traversal **is not an atomic combined SQL/media snapshot**: for real traffic, define an application write barrier or another proven consistent snapshot/reconciliation strategy; validate an isolated SQL+media restore before claiming recovery guarantees. Keep past snapshots during migration/cutover; never prune before restoration evidence.

The nightly script `/usr/local/sbin/menuminute-nightly-backup` and `menuminute-backup.{service,timer}` were proposed but **operator installation, first success, timer enablement, external failure alerting and retention have not been confirmed**. Before operational sign-off inspect `systemctl list-timers --all`, `systemctl show menuminute-backup.service -p Result` and `restic snapshots`, inspect actual journal on failure (redact secrets). Set and test an off-host alert destination; a host-only check cannot report complete host loss. Run periodic `restic check`/`--read-data` within resource budgets and perform a disposable restore, never into live `menuminute`. Agree SLO, RPO/RTO, retention, disk/WAL/media growth, outage response and escalation with the operator. No single-host HA or million-order capacity claim.

## Failure containment and rollback

- On invalid release digest, source/tag mismatch, native module failure, permission failure, failed migration or lost host-key identity: **stop**. Do not bypass checks, rerun a production seed, run `db:push`, or replace ERP binaries.
- If the new web/worker application fails, switch **both** symlinks only to a previously verified **schema-compatible** release, restart only MenuMinute units and recheck readiness and ERP. The Actions helper's rollback is application-link-only. It does not reverse migrations, erase jobs, remove media or revert newer business writes.
- If a schema or data change is incompatible, preserve the current database/media/backup and prefer a reviewed forward correction. A database restore after live writes is an incident decision with explicit data-loss/reconciliation assessment, not a routine rollback.
- When public Nginx routing fails: `nginx -t`, verify Food's distinct server block/SNI, test loopback readiness, and monitor ERP before/after a graceful Nginx reload; never replace the ERP server block or Cloudflare Origin CA material as a workaround.
- Do not run destructive cache/queue flushes, migrations or cleanup on the shared ERP host. Keep immutable prior releases until approved retention and recovery conditions are met.

Related contracts: [Actions deployment](deployment-actions.md), [architecture](architecture.md), [operations](operations.md), [server inventory](server-inventory.md), [environment](environment.md), [Phase 3 media](menu-product/operations.md), and [agent rules](../AGENTS.md).

## CI/CD 2.0 operator handoff (source change, not verified VPS state)

The main CI artifact contains only allowlisted native ARM64 runtime outputs,
reviewed SQL migrations and production dependencies. Publication verifies
the original successful main CI run ID and final aggregate quality gate;
deploy checks the publisher's provenance artifact, rather than trusting
a downstream workflow SHA. The stage job uses `production-staging`. Only
an eligible cutover appears in the `production` GitHub environment with
https://food.bababuilds.com as the application URL. A readiness response
with a missing/mismatched public release SHA is **not** verified live.
Automatic recovery restores only the previously healthy schema-compatible
web/worker application if a post-cutover public check fails.

The installed root-owned helper must explicitly report version **2** before
using this design. The one-time audited upgrade and GitHub secret/variable
names are recorded in [deployment-actions](deployment-actions.md).
The original helper's presence does not establish support for eligibility,
verification or recovery. Retain the prior helper as a root-owned backup;
do not modify global Node, systemd services, shared Nginx, PostgreSQL,
Redis, ERP, persistent media or migration ownership from Actions.

Run statuses must distinguish staged/manual-review, superseded, verified
activation, recovered application and failed/unverified. Record the exact
main SHA, immutable release, checksum, CI ID, timestamps, both symlinks,
public SHA, service and ERP outcomes after any deployment. No source-only PR
asserts that the VPS upgrade or a production cutover has occurred.

## 2026-10-18 source proposal (not operator-confirmed VPS change)

The unattended migration v4 proposal is documented in
[automatic-migration-deployment.md](automatic-migration-deployment.md). It replaces the
per-release operator marker with root-owned automatic backup and checksummed SQL execution
only after an independently reviewed one-time helper installation. The last operator evidence
above remains authoritative until live verification; do not infer helper v6, a working backup
pipeline, ordering migration 0006 or public Food Orbit activation from repository changes.

## Replacement #184 release preflight — media security

The source PR alone does **not** activate production. Before publishing or
enabling this release: preserve the current Ember browser, SMTP, Turnstile,
POS, orders and financial contracts; validate a complete six-lane quality gate
(quality, typecheck, PostgreSQL/Redis, ARM64 browser/build, Ember browser,
security); verify no database migration changes; ensure media root and
permissions exist for both Unix service accounts; verify ERP remains healthy.

**Critical proxy dependency:** Install the dedicated `/api/public-media/`
location in the reviewed Food HTTPS server using the same root-only order-edge
secret include and trusted Cloudflare real-IP configuration. Validate
`nginx -t` before a graceful reload, and verify that images from a published
QR menu return 200, then 304 for an unchanged ETag, and 404 after unapproval.
A missing/forged edge credential intentionally returns a retryable 503.
Test multiple clients behind shared networks to tune per-IP and global quotas.

For local media readiness, ensure MEDIA_ROOT is readable and writable by the
web service and by the media worker. For R2 (only if explicitly enabled),
verify endpoint, bucket scope, signed HEAD permission and the two-second
readiness latency with the actual production credentials before cutover.
A failed R2 permission check marks the web instance unready by design.
Check `/api/health/ready` media=true and database/Redis booleans without
printing secret environment files or replacing the ERP Nginx vhost.
