# MenuMinute — Architecture

Direction baseline: 14 October 2026. Distinguish existing foundation from planned modules using [the roadmap](product-roadmap.md).

## Runtime and boundaries

Keep a modular monolith: Next.js App Router, React, TypeScript, Tailwind/shadcn, Drizzle and local SQLite through better-sqlite3. Use the lockfile for versions. Existing authentication uses NextAuth; reassess its configuration/security before public onboarding rather than replacing it for this documentation task.

Host on the intended Oracle ARM64 Ubuntu VPS with Nginx and systemd. Production database, uploads and backups live outside versioned releases. Begin with one application instance and bounded background work; a small worker process may share the same local database when needed. No Redis, microservice fleet or multi-host SQLite mount is required.

Server components handle ordinary reads. Client components own interactive controls; server boundaries enforce authorization, validation and entitlements. Never trust restaurant IDs or totals from the browser.

## Existing repository

- `src/app/page.tsx`, `pricing`, `demo`: public marketing/demo routes.
- `src/app/login`, `register`, `api/auth`: authentication routes.
- `src/app/(dashboard)`: owner portal, menu manager and preview Orders.
- `src/app/(public-menu)/m/[publicMenuId]`: public menu.
- `src/app/kitchen`: future kitchen preview.
- `src/modules/restaurants`, `menus`, `qr`: starter domain services.
- `src/modules/ai`, `media`: AI stubs and starter media helpers.
- `src/db/schema`, `migrations`: Drizzle schema and SQL history.
- `src/styles/globals.css`: current orange/Inter theme.

Target additions are `src/components/ui` and shared domain components, ordering, kitchen, billing and durable job/event services. The documentation does not assert those modules already exist.

## Database and ordering

SQLite WAL permits concurrent readers but one writer at a time. Keep transactions short; never perform provider/network calls inside a transaction. Enable foreign keys, a bounded busy timeout and appropriate checkpoint monitoring. Choose durability settings explicitly and verify them on the target host.

Do not promise a request-per-second capacity from the database choice. Benchmark realistic menu reads, simultaneous order writes, SSE clients and image/jobs load. Migrate toward a server database if measured write contention or multi-host requirements justify it; no speculative migration is part of V1.

Money uses integer minor units with explicit currency and rounding rules. Order lines preserve accepted price/name/variant snapshots. An idempotency key and unique constraint protect submission; a transaction writes order, lines and initial event together. Status changes compare expected status/version and append an event in the same transaction.

The starting order schema does not yet enforce every target constraint (including idempotency and compare-and-set versioning). Add versioned migrations and tests in Phase C; do not treat a table's presence as proof of order correctness.

Every staff operation checks current membership, tenant and permission. Public menu visibility does not authorize private order/event access. Guest tracking is scoped to one order using an opaque token.

## Events and device recovery

Persist events before emitting. SSE streams are authenticated and tenant-scoped, with heartbeat/timeout handling, bounded connections and cleanup on disconnect. Reconnect uses a cursor/replay where retained, otherwise a current snapshot. Polling is a fallback; streams are not the database.

Kitchen and guest views show offline/reconnecting/last-synced state. Retry safely after ambiguous responses. Do not assume an in-memory event emitter can recover across restarts or multiple processes. Configure Nginx streaming behavior and test through the production proxy.

## Media and AI

Follow [AI and media policy](ai-and-media.md). Resolve approved persisted media or local SVG while rendering; suggestion and generation jobs run separately with quotas. R2 is the planned production object store. Harden the current upload scaffold before exposing it publicly.

## Operations and PWA

Public read-only menu snapshots may be cached with version/expiry metadata and an offline label. Private order/status APIs and subscription data must not enter shared caches. No background replay of order mutations.

Use Litestream or an equivalent verified SQLite-aware offsite backup approach. A plain copy of an active database without its WAL is not an acceptable backup procedure. Demonstrate restore on a clean machine and record observed recovery time/data loss. Proposed pilot objectives are RPO ≤1 hour and RTO ≤4 hours, not an existing guarantee.

Deployment gates include persistent data paths, secret configuration, tested migrations, rollback compatibility, HTTPS, health/disk monitoring, graceful shutdown and target-host load testing.

Reference: [SQLite WAL documentation](https://www.sqlite.org/wal.html), checked 14 October 2026.
