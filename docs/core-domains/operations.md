# Core domains — operation and rollback

Phase 2 adds management APIs and `/dashboard/organization`, active outlet selection, explicit
entitlement grants, and an organization projection worker. Ordering, KDS and payment collection
remain later phases. This is source and a release candidate, not a production deployment.

## Database and process separation

Before migrations 0002–0003, a database administrator creates `menuminute_worker` using
`infra/postgres/bootstrap.sql` and sets its credential separately. Existing installations already
have the app role: execute only the new worker CREATE ROLE statement. Never rerun CREATE ROLE for
an existing role. Apply `pnpm db:migrate` as the existing migration owner. Do not edit applied files.
The migration owner owns checked SECURITY DEFINER functions with fixed search paths; PUBLIC cannot
execute them. Web has no direct administrative or entitlement writes. Worker can read/update outbox,
insert receipts and maintain projections, but cannot read auth/merchant data or issue entitlements.

Build on Linux ARM64 with frozen dependencies. `pnpm build` produces the web release;
`pnpm build:worker` produces `dist/worker.mjs`. Stage a separate worker release with this file,
package.json, pnpm-lock.yaml, pnpm-workspace.yaml and `pnpm install --prod --frozen-lockfile` on ARM64.
The worker bundle externalizes packages: copying the one JS file without production dependencies
is insufficient. Keep web standalone assets separate. Never provide WORKER_DATABASE_URL or
MIGRATION_DATABASE_URL to the web process. Worker receives only WORKER_DATABASE_URL and
REDIS_QUEUE_URL; cache Redis has no role in delivery. The browser harness strips both SQL privileges.

`infra/systemd/menuminute-worker.service` is a reviewable unit for a separate Unix user/release path.
It is not installed. Review combined web/worker/database/Redis budgets and ERP headroom before any
installation. Worker pool max 3, concurrency 2, dispatcher batch 25, no overlapping local dispatches;
multiple processes coordinate through SKIP LOCKED. Queue Redis must retain the noeviction policy.
BullMQ 5.80.11 (MIT, supported Node range) pins ioredis 5.11.1; Linux ARM64 uses the JS fallback for
the optional msgpackr-extract addon, whose install script is explicitly disabled. No new native build
script is trusted. Existing native build policy stays intact. esbuild is pinned to the existing 0.28.2.

## Entitlement issuance

There is no public grant endpoint, payment gateway or inferred plan entitlement. Operators use
`pnpm billing:entitlement /secure/path/command.json` with MIGRATION_DATABASE_URL in an administrative
session. Keep the file outside releases and logs. A grant command has this shape:

```json
{
  "action": "grant",
  "key": "d4f38a77-456b-4e92-8241-c90d3e6b786e",
  "organizationId": "explicit-organization-id",
  "operator": "approved-operator-reference",
  "reason": "Approved entitlement authorization reference",
  "capability": "ordering.new",
  "billingCurrency": "USD",
  "startsAt": "2026-11-01T00:00:00.000Z",
  "endsAt": "2026-12-01T00:00:00.000Z"
}
```

Revoke uses action/key/organizationId/operator/reason plus grantId, omitting window/capability/currency.
The same key and command returns its stored result; differing input conflicts. UTC windows are
explicit and not an automatic subscription, renewal, trial or grace policy. Platform currency is
USD/INR, independently of outlet currency. Operators record authorization; this tool never charges.
Owner-only billing state reports effective grants. Legacy subscriptions are not authorization.

New-work services must use `withEntitledOutlet` in the same transaction as their durable business
write and outbox insert. It holds the shared organization lock, rechecks current scope, and evaluates
expiry using current database time after waiting. Accepted work completion uses ordinary permissions
without a new-work grant. No Phase 2 API creates real orders or kitchen jobs.

## Delivery failure and recovery

PostgreSQL audit + command receipt + outbox commit together. Redis jobs contain event/scope/schema,
attempt and monotonic delivery sequence only. Enqueue occurs outside SQL. Claims have 30-second
leases; dispatched events without a receipt become due after 60 seconds. Dispatch/consumer failures
have bounded retries (default 20); finite exhausted batches become failed. Queue and process loss
cannot erase the PostgreSQL event. Retained Redis jobs do not block operator retry because sequence
numbers never reset. Failed rows show a safe error code in the organization view; an authorized admin
can retry after investigation, with an audit record. Refresh status to observe progress. Recent UI
lists cap at 30; use SQL operations queries for full backlog, oldest due and retention planning:

```sql
SELECT status, count(*), min(created_at), min(next_attempt_at)
FROM outbox_events GROUP BY status;
SELECT organization_id, max(version), max(updated_at)
FROM domain_projections GROUP BY organization_id;
```

Consumer effect and receipt commit together; duplicates do not repeat the effect, and older events
cannot roll the projection backward. The current consumer performs only a system projection, valid
after member revocation or organization suspension. It does not carry delegated user authority.
Future user jobs must resolve current authority; external effects require provider idempotency and
ambiguous-result reconciliation. Do not interpret delivery as exactly once across external services.

SIGTERM stops dispatch, drains active jobs and closes connections with a 30-second deadline. A forced
stop recovers through leases/stalled handling. On Redis loss restore queue Redis service then run the
same worker: due durable events repopulate it. On prolonged backlog stop expansion and investigate;
security revocations remain available. There is no automatic deletion of audits, receipts or failed
jobs from PostgreSQL; set an approved retention policy before large-scale rollout. Systemd and backlog
monitoring must be wired to approved alert destinations before production launch.

## Rollback

Stop/drain worker first; roll web/worker executables back to the prior reviewed ARM64 artifacts.
Keep additive tables, grants, delivery history and migration ledger. Old web reads remain compatible,
but its direct outlet UPDATE privilege is intentionally revoked; privileged management writes must
use the new service or a separately reviewed compatibility patch. Do not undo suspension or grants by
dropping tables. Restore database only through the existing backup/restore process after assessing
business data since backup. No infrastructure is changed by this PR; production restore evidence,
alerting and combined ERP resource review remain release gates.
