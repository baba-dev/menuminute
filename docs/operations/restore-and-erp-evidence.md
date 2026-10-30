# Recovery and ERP coexistence evidence — issues #131 and #49

**Source tooling only, not run on the live VPS.** This augments [production-runbook](../production-runbook.md) and [Phase 4 evidence contract](../orchestration/phase-4-ops-evidence.md). A merge is not recovery, alert-delivery or capacity evidence.

## Invariants

- Production is PostgreSQL 17 `menuminute` on 127.0.0.1:5432; private media is `/var/lib/menuminute/media`; ERP listens on 127.0.0.1:3000. Do not change any of these, touch ERP Node 20/PM2, loosen RLS, or execute a destructive production SQL query.
- Isolated recovery means a **separate** disposable VM or isolated container with no route to production DB, Redis, email, payment gateways, AI providers or customer systems. Use PostgreSQL 17 on 127.0.0.1:15432, its own `mm-drill`-named data directory and an empty `mm_drill_*` database.
- Restic R2 is encrypted **backup**, not live media. A PostgreSQL dump plus a filesystem media traversal are not an atomic common SQL/media snapshot. Evidence must explicitly report any inconsistency, RPO/RTO uncertainties and missing objects.
- Logs and issue comments must not contain backup secrets, raw paths to customer files, customer data, DB rows, private environment files, URLs embedding credentials or SQL connection strings. No automated release, backup timer, notifier or fiscal/payment activation is installed by this source PR.

## A0. Operator-reviewed nightly backup installation — NEW SOURCE ONLY

The owner-supplied VPS audit on **30 October 2026** showed:

- Both active release links point to SHA `880ab86fe1173eeb9f1e9af49ffd93f783953f77`.
- The root-only Restic wrapper exists at mode 0700; 37 snapshots are visible. The newest five snapshot roots include private media but have no nightly tag. Their database-dump payloads and exact consistency were not yet inspected.
- `menuminute-backup.service` and `menuminute-backup.timer` are both `LoadState=not-found`: **there is no installed systemd nightly backup** (other cron mechanisms were not investigated). A nonexistent service reporting `Result=success` is not execution evidence.
- ERP and MenuMinute each return HTTP 200; 31 GB root disk and 21 GiB available RAM are point-in-time observations, **not** shared-load acceptance.

The root-controlled [nightly-backup.py](../../infra/ops/nightly-backup.py) and [systemd templates](../../infra/systemd/) are the source implementation. The job makes a full PostgreSQL **17** custom-format dump via the local postgres OS superuser/peer authentication to bypass FORCED RLS _for backup only_, validates `pg_restore --list` and required `onboarding_progress`, captures both private root-controlled web/worker environments and the matching application release identity, then sends the dump and local private media to the _already configured_ encrypted Restic repository. A constant `menuminute-nightly` tag distinguishes these backups from migration-triggered backups. It requires a **new** snapshot ID with both payload roots before reporting success. Temporary dump and environment copies are deleted from the local staging directory on exit; the encrypted off-host snapshot is retained. The script does not change any SQL rows, media bytes, ERP processes, application releases or existing snapshots. It deliberately **does not prune Restic snapshots**; approve retention only after recovery has been tested.

**Installation is a separate, privileged operator action, not a consequence of merging the PR.** Review/pin an exact signed/trusted source revision and verify the installed file digests. Copy from a vetted repository checkout on the VPS, or transfer copies from a trusted administration machine. Avoid executing remote pipeline scripts or installing from an unreviewed moving branch.

```bash
# Only after code review, full green CI, and an authorized operator decision.
# These source paths must be from the exact reviewed commit.
sudo install -d -o root -g root -m 0700 /var/backups/menuminute
sudo install -o root -g root -m 0700 infra/ops/nightly-backup.py \
  /usr/local/sbin/menuminute-nightly-backup
sudo install -o root -g root -m 0644 infra/systemd/menuminute-backup.service \
  /etc/systemd/system/menuminute-backup.service
sudo install -o root -g root -m 0644 infra/systemd/menuminute-backup.timer \
  /etc/systemd/system/menuminute-backup.timer
sudo systemd-analyze verify /etc/systemd/system/menuminute-backup.service \
  /etc/systemd/system/menuminute-backup.timer
sudo /usr/local/sbin/menuminute-nightly-backup --check
# Only if all preflight checks pass and external backup cost is approved:
sudo systemctl daemon-reload
sudo systemctl start menuminute-backup.service
sudo systemctl show menuminute-backup.service \
  -p Result -p ExecMainStatus -p ExecMainExitTimestamp
# Check NEW tagged snapshot and media + SQL payload from an operator account.
sudo /usr/local/sbin/menuminute-restic snapshots --json --tag menuminute-nightly
# Activate the independent schedule only after the first verified off-host run.
sudo systemctl enable --now menuminute-backup.timer
sudo systemctl list-timers --all menuminute-backup.timer
```

Installed timer defaults to **02:45 Asia/Kolkata**, up to 15 minutes randomized delay, with `Persistent=true` after missed schedules. It is independent of CI and deployment. The unit constrains memory, CPU and I/O but must be tested against the exact installed Restic wrapper (including its cache and credentials) and root-only PostgreSQL socket permissions. **Never downgrade any installed backup security to make this test pass**; audit the failure and revise the source.

A successful nightly run is **not yet a restore drill, an atomic SQL/media recovery point, an externally delivered alert, or a measured ERP capacity sign-off**. If a backup fails, keep both issues open and investigate privately; do not hide the job failure by treating a last-known snapshot as current success.

## A. Nightly backup and off-host alert (#49)

The authorized operator collects a dated, redacted transcript on the production VPS:

```bash
date -u
readlink -f /var/www/menuminute/current
readlink -f /var/www/menuminute/worker-current
systemctl is-active menuminute-web.service menuminute-worker.service
systemctl list-timers --all 'menuminute*'
systemctl show menuminute-backup.timer -p ActiveState -p UnitFileState -p NextElapseUSecRealtime
systemctl show menuminute-backup.service -p Result -p ExecMainStatus -p ExecMainExitTimestamp
sudo /usr/local/sbin/menuminute-restic snapshots
curl -fsS -o /dev/null -w 'ERP HTTP %{http_code}\n' http://127.0.0.1:3000/
curl -fsS -o /dev/null -w 'MenuMinute HTTP %{http_code}\n' http://127.0.0.1:3100/api/health/ready
```

If the timer does not exist, is not enabled, or no executed nightly backup is evidenced, the gate is **blocked** regardless of older migration backups. The source [backup-watchdog.py](../../infra/ops/backup-watchdog.py) checks timer state, last service success and recent Restic snapshots:

```bash
sudo python3 infra/ops/backup-watchdog.py --max-age-hours 30
# Add --tag YOUR_APPROVED_NIGHTLY_TAG if the nightly snapshots carry a tag.
```

Install a reviewed root-owned copy in a controlled ops path if the script is not packaged in the currently deployed artifact; do not assume a new source file is already on the host. A matching snapshot should correlate within six hours of the service completion. Run a reviewed `restic check` and bounded data verification separately; a listing alone does not validate restorable bytes.

**External monitoring must run on a separate host/service**, independently polling this command or expecting a heartbeat so that an inaccessible VPS creates an alert. Test the actual remote monitor's notification channel without breaking backups:

```bash
python3 infra/ops/backup-watchdog.py --synthetic-failure
# Expected failure exit status 1, no service or backup change.
```

Capture _actual alert delivery and acknowledgement_ on an off-host recipient plus a missing-heartbeat/unreachable-host test. The probe intentionally never claims that a notification was delivered; its success is only local evidence.

## B. PostgreSQL 17 + media isolated restore (#131)

1. Choose one exact verified Restic snapshot with a complete v7-or-later custom-format forced-RLS dump and related private media. Record snapshot ID/time, deployed SHA, dump SHA-256 and media capture time in a restricted operator evidence store. Do not infer dump filenames or source parity from historical documentation.
2. Recover the chosen snapshot into a **new disposable machine**, for example under `/srv/mm-drill-20261030/recovered`. Verify dump presence with `pg_restore -l`. Never restore directly onto production files, PostgreSQL, Redis, service paths or any ERP directory. Never copy Restic credentials to CI or the source repository.
3. Provision a **separate PostgreSQL 17 cluster**, e.g. with data dir `/srv/mm-drill-20261030/pg17`, loopback port **15432**, and empty `mm_drill_oct30` database. Provision required nonlogin test roles and reviewed grants/extension requirements on this isolated cluster. Use local secure authentication or a mode-0600 pgpass file, not passwords on the command line. Block external providers; do not start the restored application worker.
4. From the isolated host, using the recovered dump, run:

```bash
export DRILL_PGDIR=/srv/mm-drill-20261030/pg17
export DRILL_DUMP=/srv/mm-drill-20261030/recovered/path/to/actual.dump
export DRILL_MEDIA=/srv/mm-drill-20261030/recovered/var/lib/menuminute/media
export DRILL_TOOL=infra/ops/isolated-restore-drill.py

python3 "$DRILL_TOOL" --mode preflight --dump "$DRILL_DUMP" \
  --port 15432 --database mm_drill_oct30 --expected-data-dir "$DRILL_PGDIR"
python3 "$DRILL_TOOL" --mode restore --dump "$DRILL_DUMP" \
  --port 15432 --database mm_drill_oct30 --expected-data-dir "$DRILL_PGDIR" \
  --confirm RESTORE_ONLY_TO_DISPOSABLE_MM_DRILL
python3 "$DRILL_TOOL" --mode verify --dump "$DRILL_DUMP" \
  --port 15432 --database mm_drill_oct30 --expected-data-dir "$DRILL_PGDIR" \
  --media-root "$DRILL_MEDIA"
```

The restore command **writes only to the pre-created empty disposable database**, uses a single PostgreSQL transaction and does not drop/clean/create databases. It fails on production DB names, default 5432, nonloopback hosts, mismatched data directories or missing required backup content. It does not configure an isolated PG server automatically.

Verification records forced RLS on restored `onboarding_progress`, non-superuser/non-BYPASSRLS app/worker role flags, all restored user-table row counts and an aggregate checksum, private-media regular file count/bytes and full-content hash. It refuses symlinked private media and does not print customer filenames. Supply optional `--expected-row-digest` and `--expected-media-digest` derived from the **contemporaneous source snapshot manifest** if they exist. Without them, the parity booleans remain false rather than suggesting proven source parity.

**Mandatory independent manual checks:** verify representative order/finance/audit/outbox/QR values, role-specific negative `SET ROLE` permission tests, actual RLS behavior for synthetic cross-tenant fixtures, private media permissions/access revocation and SQL-to-media reference continuity. Catalog flags alone are not access-control verification. If dump ACLs/roles were excluded, rehydrate reviewed grants in the isolated environment before checking them. Record orphan media, missing files, timing skew and safe rollback. Measure full recovery elapsed time, from fetching backup bytes to validated application behavior, and distinguish it from the script duration. RPO and RTO require explicit owner thresholds; a daily dump cannot promise zero loss.

After review, securely dispose of **only** the isolated fixture and keep the evidence private. Never delete or rewrite production databases, releases, local media, existing Restic snapshots or ERP data.

## C. Measure ERP coexistence (#49)

The [erp-coexistence.py](../../infra/ops/erp-coexistence.py) sampler uses fixed **loopback** ERP and MenuMinute endpoints, disables proxy/redirect escape, and collects bounded Linux measurements: CPU, available memory, root free space and block I/O, approximate PostgreSQL/Redis process RSS, MenuMinute systemd cgroup memory/tasks, HTTP probe latency and failure counts. It reads neither process arguments nor environment, SQL rows nor response bodies.

On the actual shared VPS, measure both quiet and representative service periods (no generated production orders):

```bash
python3 infra/ops/erp-coexistence.py --label quiet-baseline --samples 24 --interval 5 \
  > mm-erp-quiet-summary.json
python3 infra/ops/erp-coexistence.py --label normal-service --samples 24 --interval 5 \
  > mm-erp-service-summary.json
```

Observe ERP HTTP status both before and after, application/service identity, exact deployed web/worker SHA, live traffic characteristics, database connection/query load, PostgreSQL WAL and queue/cache Redis depth, and overall disk saturation. The sampler's HTTP p95 represents its own **probe** timings, not real user-transaction p95. PG/Redis summed RSS double-counts shared pages and is for trend comparison only. If root block I/O is null, attach host-provider or `iostat` measurements. No workload capacity claim without an approved load profile, measured SLO thresholds and owner sign-off. The existing `infra/load/kitchen.js` expressly forbids production synthetic traffic.

## Acceptance ledger — keep both issues OPEN until executed

| Gate                    | Actual required evidence                                                                                               | Current state |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------- |
| #131 snapshot           | Identity, dates, dump digest, source SHA, matching media                                                               | Not run       |
| #131 recovery           | Separate PG17 cluster, successful restore, forced RLS, non-owner role test, row/media and app-reference reconciliation | Not run       |
| #131 recovery objective | Full measured elapsed recovery, RPO/RTO assessment, SQL/media consistency gap                                          | Not run       |
| #49 backup              | Nightly installed/enabled, successful completion, current off-host snapshots, retention/integrity                      | Not run       |
| #49 external alert      | Independently monitored host loss and confirmed recipient delivery of a synthetic failure                              | Not run       |
| #49 coexistence         | Actual ERP before/after and representative p95/error/CPU/RAM/I/O/PG/Redis measurements vs approved limits              | Not run       |
| #49 additional          | Real merchant/media/QR smoke (#47); signed edge failure modes and optional log-collector review                        | Not run       |

Attach dated **redacted** operator evidence, actual deployed SHA, observed values, reviewer and explicit pass/fail as comments on [#131](https://github.com/baba-dev/menuminute/issues/131) and [#49](https://github.com/baba-dev/menuminute/issues/49). A merged PR, source tests and tool output without operator testing cannot close either issue.

Developer-only checks (do not connect to VPS):

```bash
python3 -m unittest discover -s tests/deploy -p 'test_ops_guardrails.py' -v
python3 -m py_compile infra/ops/*.py tests/deploy/test_ops_guardrails.py
```

No database migration, application runtime change, installer, deployment workflow modification or credential change is part of this package.
