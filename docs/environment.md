# Environment contracts

## Phase 1 runtime

The Phase 1 branch accepts PostgreSQL DATABASE_URL, bounded pool size, APP_URL, an explicit
AUTH_SECRET (32+ characters) and two distinct Redis URLs. No SQLite or default-secret runtime
fallback remains. See [Phase 1 implementation and cutover](foundation/phase-1.md).

| Target variable                                | Purpose / requirement                              |
| ---------------------------------------------- | -------------------------------------------------- |
| APP_URL                                        | Canonical public HTTPS origin in production        |
| DATABASE_URL                                   | PostgreSQL runtime-role connection URL             |
| MIGRATION_DATABASE_URL                         | Separate migration-owner URL; deploy job only      |
| DATABASE_POOL_MAX                              | Validated per-process pool budget                  |
| REDIS_QUEUE_URL                                | Dedicated BullMQ non-evicting instance             |
| REDIS_CACHE_URL                                | Dedicated cache/limits instance                    |
| AUTH_SECRET / APP_URL                          | Explicit Better Auth secret and canonical base URL |
| TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY      | Public widget key / server-only verification key   |
| R2_ENDPOINT / R2_BUCKET_NAME                   | Object endpoint and bucket                         |
| R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY        | Scoped server-only credentials                     |
| GEMINI_API_KEY / NVIDIA_API_KEY                | Optional selected-provider credentials             |
| CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN   | Optional Workers AI credentials                    |
| PEXELS_API_KEY / RESEND_API_KEY                | Optional stock/email provider credentials          |
| AI_FEATURES_ENABLED / IMAGE_GENERATION_ENABLED | Default off; quota and entitlement still required  |
| POS_STRIPE_ENABLED                             | Default-off Stripe Checkout runtime gate           |
| POS_STRIPE_SECRET_KEY                          | Server-only Stripe API key when enabled            |
| POS_STRIPE_WEBHOOK_SECRET                      | Server-only signing secret for the POS webhook     |
| PWA_OPERATIONAL_ENABLED                        | Default-off guest/POS/Kitchen operational PWA gate |
| PWA_OPERATIONAL_OUTLET_IDS                     | Comma-separated exact outlet rollout allowlist     |

Billing and edition are opt-in: the hosted service must set `COMMUNITY_EDITION=false`; `RAZORPAY_ENABLED=false` and `RAZORPAY_KITCHEN_ENABLED=false` are safe defaults. Before enabling Razorpay install verified production plan IDs, webhook/REST keys and a distinct restricted `BILLING_DATABASE_URL` identity. Never reuse the application or migration-owner credential. Self-hosted edition needs a separately provisioned, owner-controlled database configuration.

Set explicit connection/request timeouts and pool/concurrency limits in validated configuration.
Implementation may rename variables for SDK conventions, but must update the schema, examples,
operations guide and CI together. Do not expose secrets through NEXT_PUBLIC variables.

Missing required production values must fail startup without printing them. Missing optional AI
keys disables the feature. Readiness reports dependency status without leaking connection strings.
Store production secrets outside the repository and application releases with restrictive permissions.
Do not copy demo passwords, development defaults or CI test secrets into production.

Operational PWA phases F-G require both `PWA_OPERATIONAL_ENABLED=true` and an exact outlet ID in
`PWA_OPERATIONAL_OUTLET_IDS`. The allowlist is capped at 50 unique IDs and may be staged while the
master switch remains false. This gate does not replace outlet publication, POS/Kitchen activation,
subscription entitlement, or RBAC. Remove an outlet from the list (or turn off the master switch) to
stop new guest offline enrollment and operational enhancements on the next server render.

## Current production credential placement (2026-10-16)

The deployed web/worker environment files are root:root mode 0600 at
`/etc/menuminute/web.env` and `/etc/menuminute/worker.env`. Separate initial-provisioning
connection inputs exist at `/etc/menuminute/{migration-db,web-db,worker-db,redis-queue,redis-cache}.env`.
They are **not** interchangeable with the optional newer Actions deployment runbook's
`/etc/menuminute/migration.env`: provision that optional file deliberately from the approved
migration-owner credential if adopting that workflow; do not assume it already exists. Never copy
or show values to agents/CI. Production Redis queue/cache listen on ports 6381/6382 with their
already-provisioned independent ACL identities; 6379/6380 in CI are isolated synthetic test values.
Web uses its restricted application DB role, both Redis connections, auth secret and local media;
worker gets only its restricted worker DB URL, queue URL and local media config. Never provide
migration owner/auth secret to worker, or R2 restic credentials to either service.

Live originals and derivatives use `MEDIA_STORAGE=local` and
`MEDIA_ROOT=/var/lib/menuminute/media`, **not** an application R2 media bucket. R2 restic settings
are private root-only at `/etc/menuminute/backup/`. The current paths, installed Node/runtime
and evidence status are described in [production runbook](production-runbook.md).

## Media storage and abuse-limit configuration (replacement for #184)

Local mode (current production) requires MEDIA_STORAGE=local and an absolute,
pre-provisioned MEDIA_ROOT shared only by the web and worker service identities.
MEDIA_OUTLET_BUDGET_BYTES defaults to 104857600 (100 MiB) for backward compatibility.
Empty R2 credentials and endpoint settings are ignored in local mode; selecting
MEDIA_STORAGE=r2 instead requires all endpoint, bucket, access and secret fields.
The worker validates storage-only settings. The web validates storage and
outlet-upload budget together with its existing authentication, SMTP, ordering
and optional AI/POS settings.

PUBLIC_MEDIA_RATE_LIMIT_MAX defaults to 180 requests per signed client per
60-second window and PUBLIC_MEDIA_RATE_LIMIT_GLOBAL_MAX defaults to 12000
requests across clients for the same window. Both use cache Redis, with
atomic reservations. Do not put secrets in NEXT_PUBLIC_ variables.

**Production prerequisite:** /api/public-media/ and /api/public-menu/ must receive
the same authenticated Nginx edge attestation already used by public orders. Add
the isolated locations from infra/nginx/menuminute.conf.example to the reviewed
Food vhost; ensure trusted Cloudflare real_ip ranges are active, the app only
listens on loopback, and the root-only edge secret agrees with
ORDER_EDGE_SHARED_SECRET in web.env. Without a valid signed client identity,
image delivery and public-menu reads deliberately fail closed with 503. Do not
roll out this release before confirming live image and menu requests.

## Optional PWA Web Push (H)

Push is **off by default**. The isolated worker and web runtime need
`PWA_PUSH_ENABLED=true`, a reviewed comma-separated `PWA_PUSH_OUTLET_IDS` (up to 50
IDs), `PWA_PUSH_VAPID_PUBLIC_KEY` (65-byte P-256 uncompressed point, base64url),
`PWA_PUSH_VAPID_PRIVATE_KEY` (32-byte scalar, base64url), and
`PWA_PUSH_VAPID_SUBJECT=mailto:operations@example.com`. Do not commit real keys.
The private key is never sent to the browser. A user must explicitly subscribe on
an authorized outlet/device. The queue is limited and subscriptions are checked
against live sessions and grants. The push service accepting a request does **not**
prove that a device displayed it. No order/customer payload is sent; the service
worker shows local generic copy. Roll back by setting `PWA_PUSH_ENABLED=false`
on both worker and web; this never stops the canonical Kitchen/Orders flows.
