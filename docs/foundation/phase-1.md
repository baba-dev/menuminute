# Phase 1 — Production foundation

This branch implements PostgreSQL, database sessions, tenant services and CI/infrastructure preparation.
Phase 0 PR #14 merged during implementation. Production deployment and data inventory remain separate gates.

## Implemented boundary

- Drizzle PostgreSQL schemas and asynchronous menu/outlet services. `restaurants` is retained as
  the outlet table/API compatibility name; organizations own memberships and scoped brand links.
- Better Auth email/password and revocable database sessions, origin checks and database rate limits.
  New hashes use Better Auth's default scrypt; imported bcrypt hashes verify through an explicit
  compatibility verifier. OAuth, reset-email delivery and verification-email delivery are not enabled.
- Current owner/admin membership and composable outlet roles are checked inside tenant transactions.
  Restricted runtime role, RLS, composite category/item and brand/outlet relationships; no private demo
  fallback. Auth storage remains trusted-server data and has no public SQL API.
- Atomic organization/default brand/outlet/QR provisioning with retry-key reconciliation. The initial
  onboarding captures type, country, timezone and local currency. Full type-centered UI is slice C.
- Public menus use one allowlisted database projection. Newly provisioned outlets are unpublished;
  full merchant publishing/versioned menu workflow remains slice C. Existing imported public menus
  and explicit development seed are marked published to retain QR continuity.
- Separate Redis queue/cache configuration, bounded clients and health endpoints. BullMQ execution,
  durable outbox and reconciler remain slice B. Orders/KDS retain scaffold schema and remain disabled.
- Checksum-ledger migrations under a PostgreSQL advisory lock; reviewed source import, synthetic
  reconciliation tests, native ARM64 CI and production standalone auth/onboarding browser coverage through a local TLS test proxy.

## Dependency selection

Pinned Better Auth/core/adapter 1.7.7 are aligned to avoid a peer resolver selecting a different core.
Release published 2026-09-30, MIT; see [release notes](https://github.com/better-auth/better-auth/releases/tag/v1.7.7).
The first local resolution briefly selected newer 1.7.10 peers; those were removed rather than
retaining release-age exclusions. Review future security patches before deployment. Drizzle 0.45.2,
pg 8.23.1 and Redis JS 6.3.0 are pinned with Node 24-compatible package metadata and frozen lockfile.
The SQLite native dependency is development-only for source import/testing, absent from runtime calls.
Test infrastructure pins PostgreSQL 17.11 and Redis 8.2.9, both Linux ARM64 images; production must use
reviewed matching versions/policies. PostgreSQL uses its permissive license; Redis 8 server offers
AGPLv3/RSALv2/SSPLv1 licensing choices. Record the deployment's selected license with the release.

## Data cutover and limitations

Use an immutable consistent SQLite backup, never the live file. `db:import:sqlite` requires an empty
migrated target, owner connection, explicit session-reset acknowledgement and a JSON mapping of
legacy restaurant IDs to reviewed IANA timezones. Runtime never falls back to SQLite. Accounts,
credential hashes, IDs, QR tokens, order totals and retained records are imported transactionally;
old sessions and verification tokens are intentionally invalidated and must be announced before cutover.

The importer aborts on unmapped tables, normalized email collisions, legacy platform-admin roles,
nonempty legacy branch outlets, missing active ownership or FK/count/QR reconciliation failure.
These cases require an explicit reviewed mapping; they are not silently discarded. Source restaurant
roles map owner to organization owner, manager/service/kitchen to scoped grants. Restaurant records
become separate organizations with a default brand and first outlet. This is an explicit legacy
mapping, not an inference that similarly named restaurants share ownership.

Legacy order statuses remain historical scaffold values. Target ordering lifecycle/snapshots and
historical status mappings require slice D before order operations are enabled. Existing menu price
field names (`pricePaise`/`priceRupees`) remain compatibility names, but services resolve actual outlet
currency exponents and convert decimal text with checked integers. Fractional minor units are
rejected; no worldwide tax or discount rounding rules are assumed.

No clean production reset is assumed. Determine whether real users/data exist, rehearse import and
restore, announce session reset, pause writes and reconcile staging before any cutover. Before new
writes, restore the prior snapshot/app if needed; after new writes, forward repair or a reviewed
reconciliation/restore process is required. Do not return traffic to stale SQLite.

## Infrastructure and ERP coexistence

`infra/compose.test.yml` is for disposable development/CI only. `infra/postgres/bootstrap.sql`,
`infra/redis/`, `infra/systemd/` and `infra/nginx/` are reviewed starting templates; nothing installs
or deploys to ERP automatically. The runtime role must not own tables, have SUPERUSER/BYPASSRLS,
inherit a privileged role, or hold migration credentials. Keep the owner URL out of web.env.

Confirm hostname, OCI shape, ERP peak CPU/memory/disk, off-host backups, retention and SLO/RPO/RTO.
Use a dedicated application OS account and root-owned immutable releases. Build on ARM64 CI, stage
standalone server plus static/public assets, and link its writable `.next/cache` to an owned path
under `/var/lib/menuminute`. Never copy AMD64 artifacts. Review budgets before installing the unit;
protect ERP and do not replace existing Nginx/certificates/PostgreSQL instances.

Separate Redis instances listen only on loopback, have finite memory, queue noeviction+AOF and cache
allkeys-lru. Configure dedicated ACL credentials and service units through the reviewed host plan;
these snippets intentionally contain no production passwords. Bound per-process DB pools across web,
future workers and maintenance; initial web max 5 is not a whole-host connection budget.

`/api/health/live` reports process liveness; `/api/health/ready` checks restricted database access,
migration ledger and both Redis connections with bounded waits and no credentials in output. Neither
endpoint proves backups, restored data, load capacity or ERP safety. Startup rejects invalid env and
privileged database connections; new runtime features must retain these checks.

## Verification record

Baseline: 17 SQLite scaffold tests, lint and typecheck passed before conversion. Phase 1 replaces
SQLite runtime scenarios with real PostgreSQL isolation/migration/auth and two-Redis tests. CI records
final SHA and logs; do not infer PostgreSQL success from local compilation or an earlier SHA.
The local sandbox has no Docker/PostgreSQL service; native dependency/browser acceptance is run in
isolated ARM64 GitHub CI. Final PR includes exact results and any limitations.
