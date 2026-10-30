# Security boundaries and acceptance gates

Status: **implemented controls plus remaining verification requirements**. This is not an independent penetration-test report or regulatory certification. The earlier JWT/demo-fallback scaffold notes are obsolete as of 31 October 2026.

## Current implementation (source-backed)

- **Authentication:** [src/lib/auth.ts](../src/lib/auth.ts) uses Better Auth with the Drizzle PostgreSQL database adapter, persisted revocable sessions, verified email, CSRF/origin checks and optional user TOTP. Ordinary user MFA is _not_ required; privileged action step-up policies are separately scoped.
- **Tenancy:** [src/modules/tenancy/service.ts](../src/modules/tenancy/service.ts) sets transaction-local actor/session/outlet context and verifies outlet permissions through private SQL functions. PostgreSQL RLS and scoped SQL functions enforce tenant boundaries; UI guards alone must never authorize a write.
- **Outlet selection:** [src/modules/restaurants/service.ts](../src/modules/restaurants/service.ts) resolves only the authenticated user's tenant-visible, active outlets. There is no unauthenticated default/demo tenant fallback for private access.
- **Public ordering:** [src/app/api/public-orders/route.ts](../src/app/api/public-orders/route.ts) verifies origin, enforces a bounded JSON body and an edge-provided identity authenticated by a shared secret. [src/modules/orders/rate-limit.ts](../src/modules/orders/rate-limit.ts) uses Redis-backed limits; requests fail closed without verified proxy identity.
- **Order and finance authority:** PostgreSQL owns durable order/payment states, idempotency, outbox and financial snapshots. Payment-provider acknowledgements are distinct from staff attestations. Jurisdiction-specific statutory invoices and real financial-provider use remain guarded; see [docs/production-f-h.md](production-f-h.md) and [#226](https://github.com/baba-dev/menuminute/issues/226).
- **Media and AI:** Private media reads are scoped and signed public presentation is independently gated. Menu import requires review before publication. Ember uses allowlisted read tools with per-call authorization; its privacy and production-provider approval are incomplete and tracked in [#230](https://github.com/baba-dev/menuminute/issues/230).

## Remaining hardening work

1. **Browser CSP:** [next.config.ts](../next.config.ts) currently permits \`script-src 'unsafe-inline'\`. This limits CSP's XSS protection. Move to a framework-compatible nonce/hash strategy with a verified test matrix for Next.js, Turnstile and payment scripts before removing the exception. Do not deploy an untested blanket CSP change.
2. **RLS and revocation:** independently test horizontal and vertical tenant access, pooled connection context leakage, role revocation on existing kitchen SSE streams and restored database permissions. Automated coverage exists but is not a substitute for independent review.
3. **Live edge configuration:** verify Cloudflare -> Nginx overwrites private identity headers and that public-media/order abuse throttles behave as intended during Redis failure. Signed application checks do not prove installed reverse-proxy configuration.
4. **Privacy and retention:** define, implement and independently assess conversation/data retention, verified erasure, provider disclosure/consent and backup lifecycle before broad commercial AI access.
5. **Restore and host recovery:** verify backups on an independent host, scheduler/alerts, RLS-granted restoration and media/database consistency. [#49](https://github.com/baba-dev/menuminute/issues/49) and [#131](https://github.com/baba-dev/menuminute/issues/131) were closed as _risk accepted_, not as proven restoration.
6. **Resilience and capacity:** record 25-owner / 50-outlet mixed load with kitchen streams and recovery on both Redis instances, while measuring the shared ERP. [#76](https://github.com/baba-dev/menuminute/issues/76) and [#77](https://github.com/baba-dev/menuminute/issues/77) remain open.

## Evidence standard

Require exact deployed web + worker SHA, isolated PostgreSQL/dual-Redis tests, operator-backed merchant/guest/expeditor canary, real mobile/tablet/accessibility review, agreed capacity thresholds, independent security assessment and named release reviewer. A green CI lane, closed risk-accepted ticket or successful deployment health probe does not establish those absent checks.

Never log or publish production credentials, customer notes, token values or unredacted private media. Never run destructive tests or representative load against the live VPS.
