# Kitchen SSE hardening (PR 2)

## Boundary and purpose
This release addresses the prelaunch Kitchen findings K-0 to K-4, preserving Kitchen Pro commercial activation gates and all payment/order authorization. No changes to the ERP host, Cloudflare, production environment or kitchen entitlement occur from source alone.

## Stream admission / resilience
- Authenticated session is verified against Better Auth DB with explicit immutable request headers on every 3-second poll. MFA-enrollment rules and current kitchen station permissions are rechecked; revocation is terminal only on confirmed 401/403/404.
- Up to **2 streams per session/outlet**, **40 per outlet**, **160 across the web fleet** via atomic Redis sorted-set reservations. Redis TIME is the clock source; all three leases expire after **18 seconds without renewal**, set TTL is 45 seconds. Disconnect, cancellation, error and end-of-window release resources. A failed Redis reservation returns 503, never unlimited admission. Snapshot queries are executed **after** admission.
- Transient DB/Redis errors emit `unavailable` and close; EventSource reconnects automatically and the existing browser fallback snapshot fetch still works. The browser clears station/customer work only on confirmed access revocation. SSE is 55 seconds, no content caching, no HTTP/2-invalid Connection header, Nginx buffering disabled by response header.
- `withOutletRead` removes the organization FOR SHARE row lock for read-only kitchen snapshots and change polls; SQL still verifies the live actor, outlet, permission and station assignment for every transaction. All writes retain `withOutlet` locking.

## Replay, retention and migration
The forward-only `0026_kitchen_stream_reliability.sql` function returns the **last event actually delivered on a page** as cursor (not the outlet high-water mark), so page >100 is replayable. Cursor 0 and empty/pruned histories now return an explicit resync when the previously seen cursor is no longer available. The existing 14-day/1,000-event kitchen and 30-day command receipt retention policy remains unchanged.

A worker-only GRANT permits `app_private.kitchen_prune_events()` from the restricted worker role; the worker calls it on initial startup and every six hours, separately from the 1s outbox dispatcher. A failed cleanup logs a generic message without failing orders, queue dispatch or web service. Cron and timers are not installed on the VPS. Retention is not deletion of historical orders or their audit ledger.

## Release validation (required before asserting production ready)
- Exact CI SHA: code style, TS, PostgreSQL/Redis integration, ARM64 build/browser and aggregate gate. Replay tests must cover >100 changes, exhausted/revoked session, over-capacity streams and disconnect recovery.
- Verify Nginx/Cloudflare public kitchen SSE route supports `text/event-stream`, `proxy_buffering off`, `proxy_read_timeout 75s`, no CDN caching, SSE not compressed, and no proxy-request/socket timeout shorter than 55s. Confirm production `/kitchen` browser read stream, mobile reconnect and ERP 200. Nginx example is not the live config.
- Preview capacity under realistic concurrent authenticated streams, DB CPU, connection slots and Redis TTL churn before claiming 160 simultaneous streams can be sustained on the shared ERP host. Revisit caps if resources cannot sustain those quotas.
- Migration apply is automatic only when helper v7 preflights/backups pass. Verify migration ledger at 0026, worker role grant, media backups and post-activation smoke. Roll back only to schema-compatible versions; never edit old migration files.

**Known boundary:** Per-request Better Auth database lookup + PostgreSQL poll at 3 seconds remains a load cost. This PR bounds and reclassifies it, but does not replace polling with LISTEN/NOTIFY or fanout. Guest checkout limits and Finance/Orders behavior are unchanged.
