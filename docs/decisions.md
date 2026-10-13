# MenuMinute — Architecture Decision Records (ADRs)

## ADR 001: Selection of SQLite with WAL Mode as Primary Database

- **Status**: Accepted
- **Context**: MenuMinute requires an affordable, zero-maintenance, highly responsive data store capable of running on a single ARM64 Ubuntu VPS.
- **Decision**: Use SQLite operated with `better-sqlite3` and `drizzle-orm` in WAL mode (`journal_mode = WAL`, `foreign_keys = ON`, `busy_timeout = 5000`).
- **Consequences**:
  - Eliminates external database servers (Postgres/MySQL) and connection pool overhead.
  - Zero network latency for database queries (<0.1ms query times).
  - Backups are trivial using SQLite online backup API (`.backup`).
  - Scale limit: Easily handles up to thousands of requests per second for read-heavy restaurant menus.

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
- **Consequences**: Zero inter-service network boundaries, simple end-to-end type safety, unified CI/CD, and single-binary deployment.

---

## ADR 005: Safe Scaffolding for Future AI & Media Integrations

- **Status**: Accepted
- **Context**: Phase 0 must prepare clean interfaces for Google Gemini, NVIDIA NIM, and Cloudflare R2 without executing billable calls or downloading unverified assets.
- **Decision**: Implement type-safe interface stubs with fallback logging and graceful degradation.
- **Consequences**: Core menu and QR functionality operates with 100% reliability offline without external API keys.
