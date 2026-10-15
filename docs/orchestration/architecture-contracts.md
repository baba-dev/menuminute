# Architecture contracts for parallel development

Status: development coordination rules for the approved modular monolith. These are target
interfaces; the current scaffold has not been migrated. Do not install speculative infrastructure
or claim compile-time enforcement from this document.

## Dependency direction

Routes/actions validate transport and call domain services. Services enforce current authorization,
business rules and transactions. Infrastructure adapters handle PostgreSQL, Redis and external I/O.
Domain modules consume another module's public contract; they do not write another module's tables.
Avoid circular imports, HTTP calls to the same app and a premature microservice split.

| Producer / contract                    | Required content before consumers implement                                                                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Foundation / tenant transaction        | Resolved actor and organization/outlet scope; transaction-local RLS context; restricted role; timeout/pool budgets; no private demo fallback        |
| Identity / authorization               | Session resolution and revocation; scoped composable roles; owner-only actions; membership mapping to domain records                                |
| Menus / published projection and quote | Stable QR resolution; published version; options/schedules; authoritative price/availability and currency; changed-quote confirmation               |
| Orders / command result                | Scoped idempotency key + canonical request hash; committed result; expected version; immutable snapshots; separate payment/fulfillment              |
| Platform / durable work                | Atomic business change + outbox intent; schema version; tenant scope; bounded retry policy; durable receipt and reconciliation                      |
| Kitchen / event recovery               | Outlet cursor ordered consistently with commit visibility; replay retention; expired-cursor full resync; authorization revocation; polling fallback |
| Media/AI / reviewed draft              | Provenance and validation; quota/no-key behavior; safe original retention; merchant approval; provider failure independent of ordering              |
| Billing / entitlement check            | USD/INR subscription domain separate from outlet money; new-order gating; accepted work may finish; exact plans remain unresolved                   |

The producer opens a contract PR before consumers write real integrations. It must contain concrete
TypeScript input/output/error definitions, caller examples, validation schemas where applicable,
transaction ownership, compatibility policy and scenario fixtures. Never use shared mutable mocks
as a second source of truth. UI can work against versioned fixtures but remains draft until wired to
real contracts and tested.

## Required semantic rules

- Actor and tenant context are resolved server-side; client IDs only select authorized resources.
- Represent money in minor units plus maintained ISO currency metadata; define zero/two/three-decimal
  serialization and overflow handling. Jurisdiction rounding/tax examples gate calculation work.
- Every command specifies transaction boundary, conflict behavior and audit/outbox writes.
- Return structured errors with stable code, safe message, retry classification and correlation ID.
  Define unauthenticated, forbidden, validation, conflict/stale version, unavailable and rate-limit
  semantics. Never expose credentials, SQL internals or other tenants' existence.
- Durable events/jobs carry ID, type/schema version, organization/outlet, aggregate ID/version,
  timestamp, correlation ID and validated payload. Include actor reference only when needed; do
  not include live session secrets. Recheck current authority when the operation requires it.
- Redis delivery is at least once. Effects must be idempotent and reconstructible from PostgreSQL.
  External calls occur outside database transactions with ambiguous-result reconciliation.
- Pending expiry competes with acceptance using stored service-session deadline and database time.
  Printed QR identity outlives guest capabilities; offline order replay is forbidden.

## Contract change protocol

1. Link producer and consumer issues and describe the incompatible behavior.
2. Reserve shared paths. Add/update an ADR for architecture changes; product owner resolves product
   changes. Do not silently rewrite approved requirements.
3. Land an additive contract/fixture revision first; enumerate all consumers and compatibility window.
4. Update consumers in dependency order; integration owner removes obsolete exports only after
   consumers migrate. Internal-only changes may land atomically in one complete PR.
5. Rebase onto current main, rerun relevant checks and record the final SHA.

## Migration and architecture decisions

One data owner sequences migrations across auth, tenant, menus, orders and durable work. Rehearse
SQLite-to-PostgreSQL mapping, hash/account reconciliation, QR continuity and tenant assignment on
synthetic/restorable data. Never resolve two migration histories by renumbering already-applied SQL.
Review constraints, indexes, RLS, backfill, locking, restore and mixed-version compatibility together.
Rollback may mean forward repair or restore; do not claim dropping new columns safely reverses data.

New ADRs use the next unused number in [decisions](../decisions.md). Include status/date, issue,
context, options, decision, consequences, affected contracts, validation and superseded record.
Approved target changes and observed runtime status must be reported separately.
