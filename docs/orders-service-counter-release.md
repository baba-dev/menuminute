# Service Counter — Orders production-readiness release package

Status: **implementation branch; NOT production verified**. Work package [#173](https://github.com/baba-dev/menuminute/issues/173). Applies to `/dashboard/orders`; no commercial Kitchen Pro enablement.

## Problem and invariant

A degraded database read must not manufacture a successful empty queue or zero counts. Merchant actions must require a recent, authorized, versioned ticket. The shared workspace top bar is the sole navigation bar. Readable ticket state, payment state and Kitchen Pro expeditor completion remain distinct.

The former UI used `Promise.all` for independent `rail` and `pulse` requests. Any failure suppressed the entire refresh and the empty illustration appeared before the first successful load. The generic `.product button` primitive also overrode KPI borders and spacing. The kitchen-managed lookup capped ticket IDs at 100 even though the Service Rail displays up to 400.

## Changed read model and API

- The Service Rail and Service Pulse requests independently succeed, fail and recover. The queue remains read-only after a failed refresh; the previous verified tickets remain visible. An unknown queue is not shown as empty. The pulse never invents zero before a verified result.
- A safe per-request `x-request-id` is returned on API errors and paired with a server-only sanitized log containing the read view and validated SQLSTATE (if any). No raw SQL or parameters, order identifiers, guest data, or credentials are logged by this handler.
- Polling runs at a bounded 8s interval when visible, skips concurrent automatic refresh and times out per fetch. Manual retries and post-mutation refreshes pre-empt older reads; aborted results cannot overwrite fresh data.
- Appends `0024_orders_rail_kitchen_scope.sql` to retrieve kitchen-managed flags for exactly the scoped ticket set, with an explicit `orders.read` permission check and a 400-ticket bound. Existing `kitchen_expo_release`, station commands and commercial gates remain unchanged.
- Order history retains separate error/retry handling, and UI cash-settlement actions only appear once the order is ready/served/collected, matching the server's payment transition contract.

## Production investigation — mandatory before claiming original incident fixed

PR #167 contained optional dashboard pulse failures, **not the cause of the production PostgreSQL error**. A source-only PR and passing test database do not prove live migration alignment. The GitHub connector has no VPS journal/database access.

1. Inspect the exact failing authorized `view=rail` and `view=pulse` requests after rollout. Record only HTTP status, request reference and SQLSTATE from `[orders] Workspace read unavailable`, never full SQL or credentials.
2. Verify deployed full SHA for both web/worker, `drizzle` migration ledger including append-only 0024, and role ownership/EXECUTE on `app_private.kitchen_managed_orders_for_rail(text,text[])`. Also verify 0006 and 0014 installed as expected.
3. If PostgreSQL reveals a further underlying failure, diagnose and repair via a **new reviewed append-only migration** before declaring incident closed. Never rewrite historical applied SQL.
4. Test current outlet with zero, one, and many tickets. Confirm cross-outlet requests remain 403/404 and no unauthorized fallback is attempted.

## Review and test requirements

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` with isolated PostgreSQL + Redis, `pnpm build` on ARM64, and `pnpm test:e2e` against isolated fixtures; validate CI aggregate gate and independent security/integration review.
- Browser assertions: one breadcrumb, four non-overlapping KPI borders, first-load/failed sync truthfulness, independently failed rail and pulse, reconnect, keyboard tabs, mobile 360/390/768/1024/1440/1920, dark/light snapshots and 200% zoom.
- Keep the existing 400-active overflow disclosure, canonical SQL authorization, expected-version conflicts, order status audit, and guest-vs-merchant lifecycle. Never use live production guest orders as a smoke test.
- Examine real-world polling cost at the 400-ticket cap and verify no severe regression under representative ERP load; do not claim load-test numbers without measurements.

## Deployment gates and rollback

Preserve release helper v4, checksum/migration guards, mandatory off-host encrypted backup before new SQL, final-head ARM64 CI artifact/digest, production Environment approvals and ERP HTTP 200 before/after activation. Merge alone is **not deployment**. Roll back application artifacts only if schema-compatible; never roll back SQL or data. Verify web/worker release identities and `/api/health/ready`; keep Kitchen Pro production safeguards disabled until independently released.

**Sign-off remains blocked** until CI, independent review and real production diagnostic/preflight evidence are recorded. No actual VPS action is claimed in this document.
