# MenuMinute — Architecture Decision Records (ADRs)

## ADR 001: Selection of SQLite with WAL Mode as Primary Database

- **Status**: Accepted
- **Context**: MenuMinute requires an affordable, zero-maintenance, highly responsive data store capable of running on a single ARM64 Ubuntu VPS.
- **Decision**: Use SQLite operated with `better-sqlite3` and `drizzle-orm` in WAL mode (`journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`).
- **Consequences**:
  - Eliminates a separately operated database server for the initial single-host deployment.
  - Avoids a separate database network hop; actual latency must be measured.
  - Use SQLite-aware online backups/replication and prove restore; account for the active WAL.
  - WAL allows concurrent readers and a single writer; capacity must be measured on the intended VPS.

---

## ADR 002: Currency Stored Exclusively as Integer Minor Units

- **Status**: Accepted
- **Context**: Representing currency in floating-point types (`real` or IEEE 754 float) introduces catastrophic rounding errors in order totals and tax calculations.
- **Decision**: Store all monetary values as integer minor units (`pricePaise` for INR, cents for USD). Display formatting is handled by centralized utility functions (`formatPrice`).
- **Consequences**: Guaranteed mathematical precision across all accounting and order total computations.

---

## ADR 003: Stable Opaque QR Tokens Independent of Slugs

- **Status**: Accepted
- **Context**: Physical restaurants print QR codes on durable materials (acrylic stands, metal plaques, table tents). If QR codes use URL slugs (`/m/spice-route-kitchen`), any name change or slug edit breaks all printed QR codes.
- **Decision**: QR codes target permanent opaque tokens (`publicId` e.g. `demo-spice-route-kitchen-v1`) that never change throughout the lifecycle of the restaurant.
- **Consequences**: Restaurants can rebrand, change names, or alter their display slugs without ever having to reprint physical QR collateral.

---

## ADR 004: Modular Monolith over Microservices

- **Status**: Accepted
- **Context**: A startup micro-SaaS should minimize operational complexity and maintain rapid developer velocity.
- **Decision**: Organize the codebase into domain modules (`src/modules/*`) inside a single Next.js App Router codebase.
- **Consequences**: Zero inter-service network boundaries, simple end-to-end type safety, unified CI/CD, and a simple application deployment.

---

## ADR 005: Safe Scaffolding for Future AI & Media Integrations

- **Status**: Accepted
- **Context**: Phase 0 must prepare clean interfaces for Google Gemini, NVIDIA NIM, and Cloudflare R2 without executing billable calls or downloading unverified assets.
- **Decision**: Implement type-safe interface stubs with fallback logging and graceful degradation.
- **Consequences**: Menu and QR functionality must not depend on AI provider keys. Offline browsing requires an explicitly implemented cache; this decision does not promise offline ordering or 100% reliability.

---

## ADR 006: Product and commercial boundary

- **Status**: Proposed baseline, 14 October 2026; free-menu/subscription model recovered from prior user direction.
- **Decision**: Keep the public menu and stable printed QR free; monetize table ordering and a specialized kitchen interface. Retain ₹149/₹299 as pilot price hypotheses, not confirmed launch economics.
- **Consequences**: Paid expiry preserves menu access. Entitlements are server-enforced. V1 guest payment is at the counter; platform subscription billing is separate.
- **Contract**: [Product direction](product-direction.md).

## ADR 007: Ink & Ember with Ember Flow and Ink Press

- **Status**: User-approved, 14 October 2026.
- **Decision**: Ink & Ember base identity; Ember Flow for everyday actions and Ink Press for a stronger tactile feel.
- **Visual contract**: Vivid color on white by day; charcoal/gold/orange by night; Bricolage display, DM Sans UI and decorative Kalam chef's notes.
- **Button contract**: Warm gradients with readable near-black labels; sparse tactile emphasis; intent-driven hover/press/pending/success/error feedback; reduced-motion support.
- **App-wide requirement**: Light / Dark / System with persistent choice and no partial-theme overlays.
- **Superseded**: Collection 01, other Collection 02 base directions and the original flat brochure buttons.
- **Consequences**: Design selection is complete. Implement shared variants and verify accessibility and behavior in Phase A; do not mistake prototype effects for server-backed outcomes.
- **Contract**: [Design system](design-system.md), [approved buttons](button-options.md), [exploration archive](design-options.md).

---

## ADR 008: Durable orders before live delivery

- **Status**: Target requirement for Phases C–D.
- **Decision**: Server-priced orders, idempotent submission, transactional status/events, tenant-scoped SSE with snapshot recovery/polling and visible stale state.
- **Consequences**: No dependence on an in-memory emitter for correctness; offline PWA is not an offline order gateway. Add missing schema constraints through migrations.
- **Contract**: [Architecture](architecture.md).

## ADR 009: Assisted content requires owner review

- **Status**: Target requirement for Phase B.
- **Decision**: Publish owner-approved assets/content only. Local SVG is always available; provider jobs are asynchronous, bounded and optional. NVIDIA trial access is not enabled for production.
- **Consequences**: No AI in menu rendering/order submission; no automatic paid fallback. Provider rights, quotas and image provenance are integration gates.
- **Contract**: [AI and media policy](ai-and-media.md).
