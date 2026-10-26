# Order submission security hardening — PR 1

Work package: #176. Review source: Claude pre-launch review O-1/O-2/O-3. This document records source behavior and operator checks, not evidence that Nginx or production has changed. The migration journal is reconciled after the merged Orders Service Counter 0024 migration.

## Mandatory deployment prerequisites

The new order and tracking endpoints **fail closed** without a proxy-asserted client IP and a shared secret. Before promoting this commit:

1. Generate a new random 32-byte-or-longer secret outside GitHub (`openssl rand -hex 32`). Add it as `ORDER_EDGE_SHARED_SECRET` to the root-owned MenuMinute **web** runtime environment only (not the worker or frontend).
2. In the **actual Food Nginx vhost** `/etc/nginx/conf.d/food.bababuilds.com.conf`, configure its public-orders location to overwrite `X-MenuMinute-Client-IP` from Nginx's resolved `$remote_addr`, and overwrite `X-MenuMinute-Edge-Key` from a root-owned, Nginx-master-readable snippet that contains the identical secret. Do not inherit incoming versions of these headers. The repository example is a reference only, never a replacement for the live ERP/Cloudflare configuration.
3. Install/verify Cloudflare's **current official published proxy CIDR ranges** in Nginx `set_real_ip_from` with `real_ip_header CF-Connecting-IP` (only Cloudflare source addresses may influence real-ip). Keep the Node listener bound to `127.0.0.1:3100`, Cloudflare Full (strict), and restrict any direct-origin access. A direct-origin request must still be attributed to the actual socket IP, not a spoofed `CF-Connecting-IP`.
4. Add `client_max_body_size 64k` to the special order-submit path. Configure and independently review edge rate/connection limiting as appropriate. Confirm `nginx -t` before a **graceful** reload, ERP 200 before/after, and a successful real non-paid staging order and tracking read through the proxy. The supported header combination must not be accepted if the caller sends an arbitrary `X-Real-IP`, `CF-Connecting-IP`, or `X-Forwarded-For`.
5. The root-owned deployment helper's candidate environment preflight must see `ORDER_EDGE_SHARED_SECRET` in web.env; otherwise fail **before** cutover. An unconfigured old Nginx location will produce 503 on public-order/tracking calls. **Merging source may queue a deploy, but the candidate must not activate unless the origin/proxy checks above have already been completed.** A blocked activation is safer than silently accepting spoofed headers.

The development-only TLS browser proxy injects the two internal headers from a **synthetic CI secret**, overwriting all browser values. It is not a production trust exception.

## Runtime policy

The first Redis Lua reservation is performed **before any body read** (60-second windows): 35 submissions/source IP and 500 submissions/application, or 150 tracking requests/source IP and 4000 tracking requests/application. After validation and outlet lookup, the second atomic reservation caps submissions at 15/source/QR, 180/QR, and 120/outlet per minute; tracking is capped at 120/source/token and 2000/token per minute. These are configurable policy constants in code, not capacity assertions. Public QR menu reads are a separate later work package. Redis failure and absent/invalid edge evidence deny mutations/reads rather than bypassing the limiter; no raw IPs or tokens enter Redis keys.

Submit payloads are read through `boundedBytes(req, 65536)`, including unknown/chunked-length bodies. A declared oversize or malformed Content-Length returns 413 without buffering. Token syntax is bounded before token-scoped Redis keys are used. The authoritative SQL submission, RLS/entitlements, prices, fingerprint, and idempotency remain unchanged.

## Database sequence and rollback

Migration `0025_order_counter_repair.sql` backfills existing outlet/business-date counters from historical orders once, then replaces `app_private.next_order_number` with an atomic counter upsert. It does **not** edit checksum-protected `0006`. Backfill holds short explicit locks: rehearse on a 100k+ order disposable copy, record elapsed time and blocked sessions, and use a quiet operational window. Post-migration, the function no longer queries order history. The migration is additive/backward-compatible for older running application code, but app-only rollback after applied SQL leaves this function in place; do not restore a database over live writes.

**Migration coordination:** PR #175 was merged first. This integration commit retains immutable `0024_orders_rail_kitchen_scope.sql` then appends `0025_order_counter_repair.sql` in journal order. Check both histories and re-run native ARM64 quality gates on the reconciled SHA; never rewrite applied migrations.

## Acceptance evidence and gates

- Spoofed forwarding headers/absent edge proof -> 503 without cache, no SQL mutation. Distinct verified client IPs have distinct limits; an unknown source is never granted an unlimited pass.
- 65,537-byte chunked body -> 413, no full-buffer read, no order creation. Invalid token does not create Redis token keys.
- Duplicate idempotency key still returns the original order; distinct parallel submissions yield different monotonically increasing daily numbers per outlet, and a new date resets to 1.
- Backfill preserves the greater of historical max or existing counter. Rehearse 100k+ legacy rows with `EXPLAIN (ANALYZE, BUFFERS)` and confirm no sequential scan per new submission.
- CI: format, ESLint, TypeScript, isolated PostgreSQL+Redis integration, ARM64 production build, Playwright checkout/tracking, aggregate gate. Independently verify security, proxy deployment and ERP coexistence before release.

No Cloudflare setting, Nginx host file, environment secret, migration or deployed release was changed by the source PR.
