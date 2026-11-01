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
- B: the original floor autosave path was replaced by the production Dining
  Floor redesign merged in PR #265. Keep the new chair/section state and
  occupancy behavior unchanged; do not reintroduce the legacy floor service.
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

Dining Floor PR #265 has been merged. This branch integrates current main and
drops the obsolete floor-autosave helper and tests; rerun the new floor
integration/browser suite with the combined code before merging.

## Phase G — report index review and safe SQL improvements

Migration `0042_reports_query_indexes.sql` already defines the partial index
`orders_outlet_business_date_report_idx` on `(restaurant_id,business_date)`
for non-NULL dates. The order schema also defines `orders_created_idx` on
`(restaurant_id,created_at)`. No duplicate migration is appropriate.

The report date filter now uses the business-date index for normal rows and
a timezone-correct UTC instant range on `created_at` **only** when
`business_date IS NULL`. Assigned business dates remain authoritative;
legacy records retain outlet-local date semantics across overnight/DST shifts.
The hourly benchmark retains its created-at local date period using UTC
instant boundaries for indexed scans.

Before additional indexes, run `EXPLAIN (ANALYZE, BUFFERS)` with synthetic
1k/10k/100k order histories and compare equal-workload timings. Inspect the
existing partial business-date index, created_at index and
`order_items_order_idx` join, and avoid additional write amplification.

## Phase H — idle worker SQL and regression safeguards

Order expiry and durable outbox dispatch retain their **1-second cadence**.
The media-upload repair sweep now executes independently at startup and then
every 5 seconds, with non-overlap protection and graceful-shutdown draining.
The queue's two domain workers and separately reserved AI-import worker are
unchanged. This reduces idle media-repair polling from approximately 3,600
per hour to 720 per hour, without slowing order/notification dispatch.

Regression checks cover the cadence constants, public-menu first-read fence,
revocation tombstones and conditional-response ETags. All POS refunds, order
expiration, kitchen queue delivery, and publication permissions must still
pass their existing integration and browser tests. Benchmark the actual
production-like PostgreSQL/Redis environment before promising throughput gains.
