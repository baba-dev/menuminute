# Database migration and target schema

Status: approved PostgreSQL design; current code still uses better-sqlite3.

## Existing baseline

`src/db/index.ts` opens SQLite WAL with synchronous=NORMAL. Schemas import sqlite-core and services
use synchronous get/all/run methods. Existing migrations and tests are SQLite-specific. A URL change
alone will not migrate the application. Keep the baseline reproducible until the replacement slice passes.

## PostgreSQL target

- Drizzle pg-core schema and pg driver; async service interfaces and transaction-scoped clients.
- Explicit organization/restaurant/outlet scope and composite unique/foreign-key constraints.
- Orders with currency, immutable item/options/tax snapshots, version, acknowledgement and separate
  payment state. Never cascade-delete business history when deleting menu/restaurant records.
- Idempotency results, outbox delivery state, consumer receipts/work records and persisted KDS events.
- Durable AI/media work and provider-attempt evidence remain in PostgreSQL; BullMQ is execution state.
- timestamptz UTC instants; outlet IANA timezone for business dates and display numbers.
- Integer minor-unit amounts with safe application serialization and checked arithmetic.
- Index open-order filters and keyset pagination by tenant/outlet/time/ID. Review query plans with
  representative volumes. Defer partitioning and search infrastructure until measured.

## Tenant database protection

Enable RLS for tenant-owned tables with separate migration-owner and non-owner runtime roles.
Runtime roles must not be superuser or BYPASSRLS. Apply appropriate FORCE ROW LEVEL SECURITY where
owner access is relevant. Set verified tenant context transaction-locally and clear it by transaction
end; test pool reuse across different tenants. Missing context denies access.

Public menu/order requests use deliberately restricted policies/projections, not a global bypass.
Workers also resolve tenant context. Test privileged/public access separately from tenant runtime.

## Migration sequence

1. Inventory whether any real data/users exist; back up and restore-test before conversion.
2. Define new schema and reviewed SQL migrations, tenant mappings, status mappings and currency rules.
3. Provision isolated PostgreSQL and Redis for integration tests; port all synchronous callers.
4. If data exists, export through a consistent SQLite backup, import to staging and reconcile table
   counts, memberships, money totals, timestamps, references, tokens and password compatibility.
5. Rehearse cutover with a write pause; final import, reconciliation, smoke checks, then switch traffic.
   If no real data exists, document that evidence before choosing a clean development reset.
6. Keep an immutable source snapshot. Before reopening writes, rollback can restore the prior app/data.
   After new writes, use reconciliation/forward repair or a rehearsed reverse migration; never silently
   roll back to stale SQLite and lose orders.

Production uses reviewed versioned migrations, one migration owner and a deployment migration lock.
No db:push or automatic demo seed. Expand/contract changes preserve rolling-release compatibility.
