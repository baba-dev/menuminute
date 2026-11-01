# MenuMinute performance baselines and rollout safety

This is a read-only baseline and regression runbook. Existing operations, authorization,
billing, publication, checkout, order lifecycle and kitchen processing remain unchanged.

## Baseline capture

1. In a synthetic test environment: `PERF_BASE_URL=http://localhost:3000 pnpm perf:baseline`.
2. Optionally include a synthetic, published QR menu with `PERF_PUBLIC_MENU_PATH=/m/<test-token>`.
3. Save sanitized JSON output and compare before/after at identical workload, Node
   release, instance size, database row counts and browser/network profiles.
4. Collect production route p50/p95/p99 (from existing process telemetry),
   PostgreSQL slow-query/pg_stat_statements evidence, connection pool wait,
   Redis cache hit/miss, worker queue age, and Chrome mobile LCP/INP.
5. Never run write/load tests against a merchant production outlet. Never put
   private QR tokens, session cookies, customer names or payment details in evidence.

`perf:baseline` intentionally samples only unauthenticated GET routes, with
at most 20 samples/route, 12-second request timeouts and no concurrent requests.
It cannot measure authenticated POS/Kitchen performance. Those require dedicated
synthetic browser scenarios and test database fixtures.

## Phase-by-phase acceptance

- A: reproducible safe baseline available, no production setup changed.
- B: dragging/repositioning a table does not update unchanged physical table
  metadata; all create/archive/rename/capacity paths retain validation and revisions.
- C: dashboard account/admin and outlet lookups overlap; same navigation and QR
  preview behavior, including deny/error fallbacks.
- D: hidden/inactive clients avoid unnecessary refresh traffic; reconnect and
  foreground reconciliation restore authoritative order state, audio and permission changes.
- E: category graphics are delivered at suitable sizes on mobile without removing
  the existing illustrations, fallbacks, or text.

## Release gate

Require formatting, lint, strict TypeScript, database-backed integration tests,
production build and Playwright acceptance tests. Exercise multiple outlets and
permissions, POS order/reprint/refund, kitchen intake/stream/revocation/Final Check,
floor autosave/concurrency/create/archive, published QR, menu browsing and checkout.
Compare timings from the same environment. If any process regresses, revert the
single phase commit instead of disabling the operational workflow.

Do not merge this performance branch until the concurrent Dining Floor redesign
PR has been reconciled and its integration tests are green.
