# Architecture decisions

Approved by the product owner through 2026-10-15. Approval records the target, not implementation.

| ADR | Decision                                    | Status              | Consequence                                                           |
| --- | ------------------------------------------- | ------------------- | --------------------------------------------------------------------- |
| 001 | SQLite WAL as primary store                 | Superseded by 006   | Historical scaffold only; no longer production target                 |
| 002 | Integer minor-unit money                    | Retained, clarified | Currency-aware precision, checked arithmetic and explicit rounding    |
| 003 | Stable opaque QR tokens                     | Retained            | Rebranding does not invalidate printed QR URLs                        |
| 004 | Modular monolith                            | Retained            | One codebase; independently runnable web and workers                  |
| 005 | Safe AI scaffolds                           | Retained, extended  | Providers remain off until configured, tested and authorized          |
| 006 | PostgreSQL + Drizzle/pg from starter        | Approved, pending   | Migrate dialect, async access, tests and data before ordering launch  |
| 007 | Two Redis workloads + BullMQ                | Approved, pending   | Non-evicting persistent queues separate from evictable caches         |
| 008 | Transactional outbox and idempotent workers | Approved, pending   | Recoverable delivery; no cross-store atomicity assumption             |
| 009 | Better Auth database sessions               | Approved, pending   | Explicit membership mapping, revocation and account migration         |
| 010 | SSE with persisted-event recovery           | Approved, pending   | Pub/Sub is not durable delivery; polling fallback                     |
| 011 | Linux ARM64 production                      | Approved            | Supersedes AMD64 host choice; audited shared Oracle ARM64 ERP host    |
| 012 | Dine-in, guest ordering, pay at restaurant  | Approved            | Payment gateways and delivery deferred                                |
| 013 | Ink & Ember UI                              | Approved direction  | Ember Flow routine actions; Ink Press tactile actions; A/B/C feedback |

## Rationale and tradeoffs

**006:** Shared restaurant write concurrency and future replicas favor PostgreSQL. Keep Drizzle,
review SQL migrations and add database-enforced tenant relationships. Do not maintain permanent
dual SQLite/PostgreSQL production paths. Connection pools and server maintenance become explicit
operational responsibilities.

**007:** Queue data must not be evicted to make room for cache entries. Separate Redis processes
provide separate memory policies; logical database numbers do not. Initially sharing a host saves
infrastructure but does not isolate host failure. Set finite retention and memory alerts.

**008:** Saving an order and enqueueing in Redis is not one transaction. Persist work intent with
the order, dispatch asynchronously, deduplicate consumers and reconcile incomplete effects.
Provider-side idempotency and reconciliation are needed for ambiguous external side effects.

**009:** Replace the early JWT scaffold while the app is young. Inventory existing users and
password hashes; verify hash compatibility before migration. Do not silently invalidate production
accounts or rely on organization plugins as outlet authorization.

**010:** Kitchen actions use regular HTTP requests; SSE covers downstream signals. Recovery uses
durable ordered events and an authoritative open-order snapshot, with a specified retention gap path.

**011 (revised 2026-10-15 after host audit):** Select the ARM64 ERP server rather than the
resource-constrained AMD64 micro VM. Build/test native modules on Ubuntu 24.04 ARM64. The audit
shows 4 visible ARM cores and 23 GiB usable RAM; the exact OCI shape/entitlement remains unconfirmed.
See [server inventory](server-inventory.md). Earlier AMD64-only guidance is superseded.

## Unresolved operational inputs

Host CPU/RAM/disk/OS are recorded in server-inventory.md. Confirm OCI shape/region, production
domain, peak ERP and Food Minutes workload, restaurant count, retention,
backup storage, availability SLO, RPO and RTO before sizing or production release. A copied table QR
is public: launch uses staff acceptance; stronger physical table-session controls can be added later.
