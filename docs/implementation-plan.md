# Implementation plan and acceptance gates

Architecture approved 2026-10-15. This PR prepares documentation only; runtime implementation follows.

| Slice | Deliverable                                                              | Dependency                                | Exit gate                                                   |
| ----- | ------------------------------------------------------------------------ | ----------------------------------------- | ----------------------------------------------------------- |
| A     | PostgreSQL, async services, tenant hierarchy/RLS, Better Auth and env/CI | Baseline inventory and hardware discovery | Migration/account reconciliation; isolation; AMD64 build    |
| B     | Two Redis workloads, BullMQ, outbox and reconciliation                   | A transaction/tenant contracts            | Crash injection and queue-loss recovery                     |
| C     | Published menus, R2 media and onboarding                                 | A; B for processing                       | Tenant-safe upload/publish; QR continuity; mobile menu      |
| D     | Dine-in ordering and staff/KDS recovery                                  | A+B; usable menu                          | Duplicate/race/reconnect suite; no false acceptance         |
| E     | Merchant-reviewed AI and Ink & Ember refinement                          | Stable domain/UI contracts                | Provider quotas/fallbacks; accessibility and visual review  |
| F     | Operational readiness and measured capacity                              | All launch slices                         | Restore drill, monitoring, load test and agreed SLO/RPO/RTO |

Keep PRs small enough to review but deliver complete slices. Do not release partial order submission
without acceptance/recovery. Security/observability accompany each slice, not a final cleanup phase.

## Initial code inventory requiring resolution in A

- SQLite services are synchronous and require actual conversion, not a connection-string replacement.
- src/lib/auth.ts has JWT credentials despite an adapter claim in its header.
- src/lib/config/env.ts supplies a development secret default; production must reject it.
- getDefaultOrActiveRestaurant may select demo/any active tenant; private routes must require membership.
- Restaurant creation writes restaurant/member/subscription around asynchronous QR generation without
  one recoverable provisioning transaction/workflow.
- Orders lack explicit outlet binding, currency, submission-key result, version and target lifecycle;
  existing cascades must not delete durable order history.
- Existing CI tests SQLite and uses Node 22 while .nvmrc/package manager constraints need compatibility
  verification. Review baseline workflow/cache configuration and package provenance before upgrading.

These are inspected planning observations, not a comprehensive audit or proof of exploitability.

## Before production

Record actual AMD64 host resources/OS/domain, expected peak diners/orders/SSE connections, retention,
backup destination, escalation owner and SLO/RPO/RTO. Establish baseline failures before changing code.
Launch uses staff acceptance and pay-at-restaurant; gateway billing/delivery scope requires a later decision.
