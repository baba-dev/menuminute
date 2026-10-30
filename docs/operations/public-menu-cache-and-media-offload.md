# Public menu cache and media offload — release runbook

PR #204 is a forward-only performance change. The existing release checks and
SQL security-definer functions remain the authority for public content.

## Consistency contract

- Redis caches a **display projection**, never an ordering authorization.
- A QR cache hit still executes the small PostgreSQL
  `app_private.public_menu_cache_token_active(token,outlet_id)` gate. This
  fails closed for revoked QRs, inactive outlets/organizations and unpublished
  menus, even when a Redis invalidation fails.
- Invalidation increments non-expiring per-outlet generations **after commit**.
  Shared menus invalidate all assignments captured before and after mutation.
- Cold token mapping is learned on the first request; the first database result
  is intentionally **not** cached because its generation was not known before
  the query. Lua enforces atomic checks before all cache writes.
- QR revocation tombstones the old token (and removes its association).
- Redis is a performance dependency, not a data-loss dependency. On outage,
  reads fall back to PostgreSQL. If a mutation commits while invalidation fails,
  a previously cached **price or availability projection** may persist for up to
  180 seconds; log alerts must surface this. Actual checkout totals, stock,
  permissions, and QR status must still be verified against PostgreSQL.
  Do not advertise unconditional sub-millisecond reads or instant freshness
  through a Redis outage.
- Scheduled dish/restaurant visibility is projected using refreshed `now`,
  so a cached document does not freeze the client clock.

## Release sequencing

1. Verify all required ARM64 CI jobs, integration security tests and migration
   compatibility checks are green. Apply only the additive 0032 migration via
   the existing unattended deployment protocol; never edit old migrations.
2. Confirm `DATABASE_POOL_MAX` explicitly on each web/worker instance.
   The conservative default remains 5. Size from measured total available
   PostgreSQL connections across deployments, not guessed dinner-rush demand.
3. Confirm REDIS_CACHE_URL points to the independent cache Redis instance.
   Monitor hit/miss ratio, DB pool wait, invalidation failures and cache memory.
4. Do NOT enable media offloading before the host-side Nginx preflight below.
   The default `MEDIA_X_ACCEL_REDIRECT_ENABLED=false` retains the tested
   Next.js response.
5. Smoke-test active, revoked and regenerated QR links, price and sold-out
   updates, shared outlets, translations, and local photos from mobile.

## Optional local-file Nginx offload

The public `/api/public-media/[mediaId]` URL MUST continue to proxy to the
existing Next.js API. The API first checks signed edge identity/rate limits,
database media publication/approval and the current storage key. Only the
resulting internal derivative path is delegated using `X-Accel-Redirect`.
There must be no public file alias. Never enable public 30-day immutable caching.

Host operator steps (preserve ERP vhost, certificates and all existing rules):

1. Review `infra/nginx/menuminute.conf.example`. Add its **internal-only**
   `/_menuminute_media_internal/` location inside the existing Food HTTPS
   server. Preserve the existing public-media proxy plus public-orders and
   public-menu edge attestation. Confirm local `MEDIA_ROOT=/var/lib/menuminute/media`.
2. Ensure Nginx's worker has read/traverse permissions only for the media
   derivative directory tree; keep original uploads restricted. Do not expose
   the media root as a separate public document root.
3. Verify `sudo nginx -t`; capture ERP and Food health status; reload Nginx;
   repeat both health checks. A direct unauthenticated GET for
   `/_menuminute_media_internal/org/asset/display.webp` must be denied.
4. With offloading **disabled**, test an approved public image and the
   304/ETag response. Check that unapproved and unreferenced images return
   404 and a rate-limited request returns 429.
5. Set `MEDIA_X_ACCEL_REDIRECT_ENABLED=true` in the **web** environment
   only after the alias and group permissions are proven. Restart the web
   service using existing release safeguards; repeat tests above and compare
   image bytes. Keep disabled for R2.
6. Rollback: set the flag to false and restart the web service. Nginx internal
   alias can remain installed safely because it is not externally addressable.

## Load verification before increasing pool size

Measure concurrent 25/100/250 public diners on actual ARM64 releases using
representative large published menus, multiple locales, and QR tokens. Record
p50/p95/p99, Redis round trips, hit/miss ratio, database connections and
CPU/RSS across web and worker processes. Increase pool size only if total
headroom, PostgreSQL max_connections and an ERP coexistence check permit it.

## Failure and rollback signals

- Alert on `[public-menu-cache] operation failed`. Investigate separately
  from Redis queue health; never silence invalidation failures.
- Roll back the application release through the established symlink mechanism;
  the additive SQL gate is harmless if left installed. Do not drop it in a
  rollback.
- If stale content is suspected, flush ONLY the dedicated menu cache namespace
  in the independent cache Redis, preserving rate-limits and other namespaces.
  First identify which keys are owned by the public menu cache and use bounded
  SCAN-based cleanup; do not run Redis FLUSHALL on shared infrastructure.
