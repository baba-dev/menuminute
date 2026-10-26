# Dashboard Production Readiness — Phases A–D

Scope: authenticated `/dashboard` overview and the shared workspace shell. No billing, ordering, publishing or QR write contracts were changed. No migrations are required.

## Invariants and architecture

- **Authentication:** `auth()` and `requestActor()` remain the source of user identity; mutation defenses and session renewal are unchanged.
- **Authorization:** PostgreSQL `withOutlet`, `app_private.lock_outlet`, and row-level security are authoritative. A URL, header, saved preference or client prop is never sufficient proof of access.
- **Workspaces:** persisted preferences are validated against currently accessible outlets; no cross-tenant fallback is allowed.
- **Performance:** the overview queries only the scalar columns required for draft and QR KPIs, not complete menu documents, stored QR SVG artwork or every order record. Matching data is deduplicated only within the current React render request.
- **Publishing truthfulness:** the released public projection, not saved drafts, drives published counts. Legacy menu rendering remains delegated to `publicProduct`.
- **Service status:** the order pulse uses the authoritative scoped aggregation. Failed access shows `restricted`; a dependent service failure shows `unavailable`—never invented zeros.
- **Response safety:** `/api/dashboard/pulse` returns `private, no-store` and `Vary: Cookie`. It disregards arbitrary `x-outlet-id` headers and accepts no client-selected organization.
- **Observability:** failed optional reads log only error type and valid 5-character SQLSTATE, not SQL text, parameters, tokens, user details or restaurant IDs.
- **Client polling:** 30-second cadence only while the dashboard tab is active; request timeout 8 seconds, no overlapping polls, abort on teardown, manual refresh and outlet-identity validation before applying a response.
- **Production safety:** the existing release helper, CI lanes, worker/ERP checks and migration policy are unchanged.

## Required launch tests

1. Unauthenticated GET `/api/dashboard/pulse` returns 401 and cannot be shared cached.
2. Authenticated owner sees only active-outlet metrics, even when sending a forged outlet header.
3. Owner/admin vs menu-editor/service/kitchen-only access produces accurate workspace navigation; absence of entitlement never means enabled.
4. QR canonical/fallback selection is stable regardless of database ordering or inactive/order-purpose identities.
5. Service data is correct at outlet-local business-day rollover; the initial server render and refresh API agree.
6. Simulate an order read timeout, PostgreSQL outage and role revocation: dashboard publishing KPIs continue working and service status explains the failure.
7. Browser tests at 360/390/768/1024/1440 widths, light/dark modes, focus and hover, with no horizontal overflow.
8. Confirm authentic production release SHA from `/api/health/ready`; do not infer live deployment from green CI alone.

## Operational acceptance

- Mandatory CI: formatting, lint, strict TS, database integrations, ARM64 production build, Playwright desktop/mobile and all required workflow lanes green.
- On a review environment, compare `EXPLAIN (ANALYZE, BUFFERS)` for dashboard menu rows, QR identities, and service-pulse query using realistic menu/order counts. Confirm no scans of unrelated tenant data and acceptable p95 dashboard latency.
- Monitor `[dashboard] Service pulse query failed` / `[dashboard] Service pulse degraded` after activation. Elevated error volume or tenant scoping failures block launch.
- Validate full auth, MFA, outlet switching, session revocation, live publishing, preview links and public QR behavior.
- An independent security review and production browser sign-off are still required; CI alone is not a penetration test.

## Rollback strategy

No schema or data rewrite is introduced. A compatible previously verified release remains recoverable through the existing root-owned release safeguards. If operational polling causes unexpected load, roll back via the verified deployment process rather than disabling authorization or uncapping database timeouts.
