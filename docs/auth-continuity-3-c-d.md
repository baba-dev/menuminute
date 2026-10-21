# Account continuity and device security (C+D)

Stacked dependency: PR #136, Better Auth 1.7.7 / PostgreSQL, no parallel token system.
Migration 0016 adds a self-only RLS preference record; it never grants access or
trusts a saved org/outlet. Active membership and outlet RLS are checked on writes
and again on EVERY read, including API requestContext, dashboard and cross-device
restoration. The legacy outlet cookie remains a fallback for unmigrated accounts.
The existing POST /api/context outletId payload remains compatible.

Device management is server-scoped to the authenticated user and shows only safe
metadata (no session token/IP exposed). Revocation deletes database sessions and
inserts security audit events in one SQL statement, excludes current session for
other-device operations, and distinguishes 404/403/network failures. This device
uses Better Auth signOut. Existing password reset, MFA, admin step-up and roles
are not changed; no new device fingerprinting or geolocation.

Release gates: migration-ledger checksum, runtime RLS, migration owner permissions,
CI exact-head strict TypeScript, format/lint, PostgreSQL integration and desktop/mobile
Playwright, native ARM64 artifact. Deploy PR #136 first, then C+D via the usual immutable
release helper. Verify same account on two fresh browsers across server restart/release
cutover and verify revoked token fails next server request; check Cloudflare private
cache bypass and external AUTH_SECRET continuity. Never copy session cookies into logs.
Production-host checks are operator-owned and cannot be proven by source CI.

CI note: this PR targets main while #136 remains unmerged because branch-target pull requests do not trigger the repository's required CI workflow. Merge #136 first; do not deploy C+D out of order.
