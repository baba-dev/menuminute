# Verification strategy

## Documentation changes

Check changed Markdown formatting, relative links, decision/status consistency and git diff whitespace.
Do not add runtime tests that merely assert document text. Report existing CI failures separately.

## Foundation implementation

Keep Vitest/Testing Library and Playwright. Run PostgreSQL and both Redis workloads through
Testcontainers locally/CI (or equivalent isolated CI services); Docker is a test requirement, not a
requirement to containerize production. Use the same pinned major versions/policies as production.
SQLite tests are baseline evidence only, not evidence for PostgreSQL transactions, RLS or locking.

Required scenarios: schema from empty DB, upgrade/rehearsed data import, pooled tenant-context reuse,
composite FK rejection, session revocation, password/account compatibility, public projection limits,
background tenant scoping, denied missing production secrets and ARM64 native module build.

## Ordering and jobs

Exercise simultaneous duplicate submissions and mismatched keys, lost response after commit,
price/version changes, current entitlement checks, race for display numbers, concurrent transitions,
worker death at claim/enqueue/effect/receipt boundaries, Redis loss after dispatch, bounded retry
exhaustion, duplicate external effects and recovery of incomplete work. Use real transactions and
multiple connections; mocks cannot establish concurrency guarantees.

KDS tests cover reconnect, revocation, wrong tenant/outlet, expired cursor, events committed out of
allocation order, snapshot/catch-up consistency and polling fallback. Browser tests cover guest cart
retention, submission versus acceptance, staff action conflicts and visible offline state.

## Performance evidence

Use k6 from a separate load generator with reproducible dataset, machine specs, artifact SHA and
traffic mix. Measure cached/uncached menu reads, order writes, transitions, long-lived connections,
AI backlog and one noisy tenant. Test burst, sustained and overload conditions, then recovery.
Track p50/p95/p99 latency, errors, duplicates, lost work, locks, pool wait, memory and oldest backlog.
Run alongside representative ERP peak activity and measure both applications for regressions.
Set numeric pass thresholds after sizing; no million-order throughput claim without this evidence.

## UI and providers

Playwright verifies mobile/desktop, keyboard/focus, light/dark, reduced motion, relevant RTL and contrast.
Provider tests use recorded/synthetic fixtures by default. Separate opt-in contract tests verify enabled
model capabilities, structured output, quotas, timeout and cancellation without unapproved paid usage.
Never submit real restaurant orders in production as a smoke test.

## Proposed CI lanes

1. Formatting, lint and dependency/security checks.
2. Typecheck and domain unit tests.
3. PostgreSQL/Redis migration, isolation, concurrency and recovery tests.
4. Linux ARM64 build and relevant Playwright checks.

Run final checks on the reviewed SHA. Existing workflow runs on Ubuntu 24.04 ARM64 but still tests SQLite;
PostgreSQL/Redis integration CI belongs to the foundation implementation slice. Record commands, test counts and failures without claiming
unexecuted browser, provider or load tests passed.

## Product acceptance additions

Exercise the [product requirement evidence](product-requirements.md): scoped brand/outlet links,
role composition/delegation, outlet-type changes, dine-in versus pickup, modifiers/sold-out schedules,
large quantities and overflow, independent subscription/local currencies, zero/three-decimal totals,
closing/acceptance races, overnight/24-hour cutoffs and printed QR continuity/revocation. Use the
25-owner / 50-restaurant / 1,000-orders-hour planning envelope with measured burst and SSE traffic.
