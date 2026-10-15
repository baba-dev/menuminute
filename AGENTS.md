# Development contract

Read this file before changing the repository. The working repository name is MenuMinute;
the product planning context is Food Minutes. Do not rename the product incidentally.

## Source of truth

- Read `docs/architecture.md`, `docs/domain-invariants.md`, and the relevant domain guide.
- `docs/decisions.md` records approved target decisions; code may still implement the old scaffold.
- `docs/implementation-plan.md` separates existing behavior from future acceptance gates.
- Production is **Linux AMD64/x86_64**. CPU, RAM, disk, OS version and production domain
  are not yet verified. Do not substitute Oracle Ampere/ARM assumptions.

## Required boundaries

- Keep Next.js route handlers and Server Actions thin; enforce authorization in services.
- Target PostgreSQL + Drizzle/pg, BullMQ and two Redis workloads from the starter.
- PostgreSQL owns durable business state. Redis is not an order ledger or authorization authority.
- Check current membership and outlet scope; never infer a private tenant from a demo/default.
- Database transactions must atomically persist business changes and outbox intent.
- Use idempotent consumers and durable reconciliation; do not claim exactly-once delivery.
- Validate all untrusted API, job and AI inputs. Never trust client prices or entitlements.
- Keep AI/media processing off the ordering request path. No autonomous AI publishing.
- Never invent ingredients, allergen safety or dietary claims.

## Implementation workflow

1. Inspect the actual files, tests, environment schema and lockfile; record baseline failures.
2. State the affected invariant, intended behavior, failure behavior and acceptance evidence.
3. Implement one complete slice with explicit migration and rollback considerations.
4. Select compatible stable dependency versions and pin reproducibly. Review package provenance,
   maintenance, license and native Linux AMD64 support; do not blindly install latest versions.
5. Test changed invariants against real PostgreSQL/Redis when that infrastructure lands.
6. Update current-status documentation when behavior changes; distinguish implemented from planned.
7. Report exact commands, results and limitations. Never describe docs as deployed infrastructure.

## Verification

- Documentation-only: formatting for changed Markdown, relative links and `git diff --check`.
- Runtime: lint, typecheck, relevant tests and production build; execute end-to-end tests for
  affected workflows. Follow `docs/testing-strategy.md` for migration and ordering gates.
- Use frozen-lockfile installs. Do not regenerate migrations merely to start the app.
- No `db:push` against production, production demo seed, secret logging or destructive migrations.
- Don't weaken checks to hide failures. Keep unrelated fixes separate and report baseline issues.
- Never request or print production credentials in commits, fixtures, logs or PR descriptions.
- Public browsing and local tests must not trigger paid providers or production order submissions.

## Delivery

Use small reviewable PRs. Include behavior, migration requirements, evidence and risks.
A documentation approval is not proof that implementation gates passed. Merging and production
release follow the task's authorization and the acceptance gates; do not deploy unfinished slices.
