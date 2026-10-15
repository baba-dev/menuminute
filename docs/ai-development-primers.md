# AI development primers

Read AGENTS.md first. These are implementation task contracts, not permission to deploy or spend.

## Reusable task template

```text
Goal:
Current code and observed behavior (file references):
Approved decision / invariant:
In scope / out of scope:
Tenant, role, outlet and guest-capability boundary:
Data migration / backwards compatibility:
Expected success behavior:
Timeout, retry, concurrent-write and dependency-failure behavior:
Tests and measurable acceptance criteria:
Validation commands actually run:
Remaining risks / rollout and recovery:
```

## Primer A: PostgreSQL and identity foundation

Inspect SQLite schema/callers, auth routes, env parsing, seeds and CI. Implement the reviewed pg-core
schema and async services, composite tenant constraints, restricted runtime RLS and transaction-local
context. Replace JWT scaffold with Better Auth database sessions and explicit domain memberships.
Preserve public QR identifiers and reconcile existing accounts/data before cutover. Remove private
fallback-to-demo behavior. Provision Redis clients/config contracts and update CI to real dependencies.
Acceptance: foundation scenarios in testing-strategy.md, complete migration rehearsal and AMD64 build.
Exclude live ordering, paid provider enablement and visual redesign from this slice.

## Primer B: Durable jobs and outbox

Implement atomic business+outbox persistence, lease-based dispatch, BullMQ IDs, durable consumer
receipts, retry classification, failed-work visibility and reconciliation of dispatched incomplete work.
Separate queue/cache Redis policies. Inject crashes around enqueue and completion; flush isolated test
Redis and prove recoverable work returns. Avoid holding SQL transactions during external I/O.
Acceptance: no required intent lost after Redis loss, duplicates safe and tenant scope preserved.

## Primer C: Dine-in ordering and KDS

Implement server-authoritative quotes, confirmation on price changes, scoped idempotent submissions,
immutable snapshots, safe outlet/business-day numbering and atomic versioned transitions. Separate
submitted, accepted and paid concepts. Build SSE signals with durable cursor recovery/snapshot resync
and polling fallback. Staff acceptance is required; copied QR URLs are not proof of physical presence.
Acceptance: ordering race/recovery suite and guest/staff browser flows; AI outages do not break orders.

## Primer D: Media and reviewed AI drafts

Implement private R2 upload/processing, safe Sharp decode/variants, provenance and merchant review.
Keep published originals safe from failed cleanup. Provider adapters validate structured output,
budgets, quotas, cancellation and bounded retries. Preserve image fallback hierarchy and no-key behavior.
Acceptance: malformed uploads, SSRF, timeout/quota, license metadata and draft approval tests.
No invented allergen/dietary facts and no unapproved paid inference or automatic publishing.

## Primer E: Ink & Ember interface

Read approved visual artifacts and design-system.md. Extend existing shadcn/Radix components, preserve
accessible semantics and implement shared light/dark tokens after verifying exact values. Ember Flow
serves routine actions; Ink Press provides stronger tactile feedback. Apply A/B/C feedback hierarchy.
Acceptance: keyboard/mobile/light-dark/reduced-motion checks and requested PDF review. Do not couple
ordering correctness to visual animation completion.

## Completion report

Explain changed behavior, migration requirements, commands/results and material untested assumptions.
Do not claim an API integration from a stub, a working deployment from docs, or capacity from row count.
