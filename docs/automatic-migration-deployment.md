# Unattended main-to-production deployment (helper v6)

**Policy:** After the exact `main` push passes all four mandatory CI lanes, the publisher creates the immutable ARM64 artifact. The deploy workflow stages it, checks current `main`, and, if eligible, calls the restricted root-owned helper with `autoactivate`. The helper applies a _new append-only_ PostgreSQL migration when present, without asking for a per-SHA approval marker or an operator console round trip. Manual `workflow_dispatch activate=true` uses the same policy, not an unsafe bypass.

## One-time server prerequisites — not performed by a source PR

The root-owned helper cannot be replaced by a source PR through the restricted
`menuminute-deploy` account. An administrator must review/install **v6**, retaining the old
executable. The workflow explicitly checks `--version = 6`. v6 adds candidate runtime
configuration preflight before migration work and a separately authorized incident recovery mode.
It also executes read-only migration verification from the staged release working directory so
candidate migration paths are resolved deterministically.
Use the exact merged commit and independently verified Git blob, as in the existing
[Actions runbook](deployment-actions.md). Do not grant deploy unrestricted sudo, root SSH or access
to other services.

Provision `/etc/menuminute/migration.env` owned `root:root`, mode `0600`, shell-compatible and containing `MIGRATION_DATABASE_URL` for **menuminute_owner** only. Do not substitute web/worker roles or put production credentials into GitHub. The repo has an earlier `migration-db.env` initial-install convention; this v6 helper requires the explicitly reviewed `migration.env`, not an implicit copy.

The existing root-only `/usr/local/sbin/menuminute-restic` must support `snapshots --json --tag` and `backup --tag`, with a working encrypted **off-host** R2 repository. PostgreSQL `pg_dump` and `pg_restore` must be installed and compatible with the server. Validate an isolated restore, retention policy and alerts separately; a successful dump alone is not a recovery drill. The service's persistent media must exist at `/var/lib/menuminute/media`. GitHub `production-staging` and `production` environments must expose the existing pinned SSH secrets and allow `main` without required reviewers if truly unattended delivery is desired. This repository connector cannot alter the installed helper or GitHub environment approvals.

## Ordered automatic execution

1. Verify the exact completed green **push** CI run, final quality gate, publisher handoff, immutable GitHub release tag and whole-archive SHA-256 digest; refuse stale `main`.
2. Stage the root-owned release, validate runtime files and service-user access, then run the exact
   candidate environment validator as the unprivileged web account. Missing or invalid variable names
   stop the release before migration inspection, backup or SQL. Only then compare migration histories.
3. Check existing MenuMinute web/worker readiness and ERP health. For a new migration, require the private owner connection, PostgreSQL tooling and working off-host backup wrapper.
4. On activation, obtain the global deployment lock, copy an owner-authenticated custom-format PostgreSQL dump, verify it with `pg_restore -l`, and create a **new remote restic snapshot** tagged for the exact candidate SHA. Capture media, root-only web/worker env, old/live identity and digest. Require the new snapshot to appear in the remote listing. If any backup step fails, **do not run migration or cut over**.
5. Execute the exact staged release's bundled `dist/db-migrate.mjs` with the private migration-owner connection. Its advisory lock, checksum ledger and per-file transactions prevent silent history rewrites and allow idempotent retries. On SQL failure, stop before switching web/worker.
6. Switch only both MenuMinute release links, restart only MenuMinute units, verify service/database/Redis readiness and ERP. The workflow independently validates public HTTPS readiness with the exact release SHA plus homepage and login.
7. Failed post-switch checks are reported as failures. Application-only rollback is automatic **only** when migration trees are identical; migrated SQL/data are never unwound or restored over new customer writes. A failed migrated release requires forward repair and incident handling.

## Limitations and operational responsibilities

- The pipeline **does not promise that arbitrary destructive or non-backward-compatible SQL is safe**. CI tests and migration review in the PR remain necessary. In particular, older web/worker processes can still be running while an additive migration is applied; design migrations as expand-then-contract and test mixed-version compatibility. SQL-changing releases are not guaranteed to auto-rollback.
- `pg_dump` plus a live media traversal is not an atomic combined database/media snapshot. Provide a write barrier or verified reconciliation/restore procedure before promising consistent recovery for busy production data.
- No production secrets are uploaded to Actions. The workflow does not edit ERP, global Node, Nginx, Redis or service templates.
- CI may pass while deployment fails because a configured resource is missing, migrations fail, production health regresses, the SHA is superseded or production environment approvals remain enabled. Such a run must **never** be marked deployed/live.
- For helper upgrades after v5, continue to use an independent one-time root-reviewed control-plane installation rather than permitting application commits to silently rewrite privileged deployment code.

## Restricted forward recovery

Ordinary eligibility still requires the current web and worker to be healthy. If an incident leaves
the application unhealthy after its migrations were already applied, an operator may create
`/etc/menuminute/recovery-authorizations/<FULL_SHA>` as `root:root` mode `0600`, containing only the
verified 64-character release archive digest. The marker expires after one hour. A manual deploy with
`forward_recovery=true` validates candidate configuration, artifact identity, ERP health and an exact
read-only match between the candidate migration files and the production checksum ledger. It never
runs migrations and never rolls back the database or application. Remove the marker after the audited
result. Automatic `workflow_run` deployments cannot select this mode.

## Historic staging blocker

Run [39142966679](https://github.com/baba-dev/menuminute/actions/runs/39142966679) staged SHA `58a58fb8daa9348b2fd244ec9d5532fa5488f7d6` and stopped at `STAGED_MANUAL` because the running tree lacked `0006_online_ordering.sql`. The successor policy applies only once the reviewed current helper is installed and actual backup/migration prerequisites pass. Neither source merge nor a new release tag is evidence the Food Orbit hero is publicly live.
