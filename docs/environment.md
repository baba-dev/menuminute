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

Set explicit connection/request timeouts and pool/concurrency limits in validated configuration.
Implementation may rename variables for SDK conventions, but must update the schema, examples,
operations guide and CI together. Do not expose secrets through NEXT_PUBLIC variables.

Missing required production values must fail startup without printing them. Missing optional AI
keys disables the feature. Readiness reports dependency status without leaking connection strings.
Store production secrets outside the repository and application releases with restrictive permissions.
Do not copy demo passwords, development defaults or CI test secrets into production.
