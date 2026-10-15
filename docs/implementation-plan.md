# Implementation plan and acceptance gates

Architecture approved 2026-10-15. This PR prepares architecture documentation and ARM64 CI alignment; runtime implementation follows.

| Slice | Deliverable                                                              | Dependency                               | Exit gate                                                   |
| ----- | ------------------------------------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------- |
| A     | PostgreSQL, async services, tenant hierarchy/RLS, Better Auth and env/CI | Audited ARM64 host; coexistence planning | Migration/account reconciliation; isolation; ARM64 build    |
| B     | Two Redis workloads, BullMQ, outbox and reconciliation                   | A transaction/tenant contracts           | Crash injection and queue-loss recovery                     |
| C     | Published menus, R2 media and onboarding                                 | A; B for processing                      | Tenant-safe upload/publish; QR continuity; mobile menu      |
| D     | Dine-in ordering and staff/KDS recovery                                  | A+B; usable menu                         | Duplicate/race/reconnect suite; no false acceptance         |
| E     | Merchant-reviewed AI and Ink & Ember refinement                          | Stable domain/UI contracts               | Provider quotas/fallbacks; accessibility and visual review  |
| F     | Operational readiness and measured capacity                              | All launch slices                        | Restore drill, monitoring, load test and agreed SLO/RPO/RTO |

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
- Existing CI still tests SQLite. It now targets Ubuntu 24.04 ARM64 with Node 24 and architecture-scoped
  caches; PostgreSQL/Redis integration jobs remain foundation work. Review package provenance and
  baseline failures before changing dependencies.

These are inspected planning observations, not a comprehensive audit or proof of exploitability.

## Before production

Use the audited ARM64 host baseline in server-inventory.md. Confirm OCI shape/region, domain,
ERP peak usage, expected peak diners/orders/SSE connections, retention,
backup destination, escalation owner and SLO/RPO/RTO. Establish baseline failures before changing code.
Launch uses staff acceptance and pay-at-restaurant; gateway billing/delivery scope requires a later decision.
