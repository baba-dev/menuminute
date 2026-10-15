# Environment contracts

## Current scaffold

`.env.example` and `src/lib/config/env.ts` still configure SQLite paths and NextAuth. Follow
`development.md` to run that baseline. The names below are a proposed target contract and are not
accepted runtime configuration until the foundation PR updates the schema, examples and tests.

| Target variable                                | Purpose / requirement                                       |
| ---------------------------------------------- | ----------------------------------------------------------- |
| APP_URL                                        | Canonical public HTTPS origin in production                 |
| DATABASE_URL                                   | PostgreSQL runtime-role connection URL                      |
| MIGRATION_DATABASE_URL                         | Separate migration-owner URL; deploy job only               |
| DATABASE_POOL_MAX                              | Validated per-process pool budget                           |
| REDIS_QUEUE_URL                                | Dedicated BullMQ non-evicting instance                      |
| REDIS_CACHE_URL                                | Dedicated cache/limits instance                             |
| AUTH_SECRET / AUTH_BASE_URL                    | Map explicitly to Better Auth options during implementation |
| TURNSTILE_SITE_KEY / TURNSTILE_SECRET_KEY      | Public widget key / server-only verification key            |
| R2_ENDPOINT / R2_BUCKET_NAME                   | Object endpoint and bucket                                  |
| R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY        | Scoped server-only credentials                              |
| GEMINI_API_KEY / NVIDIA_API_KEY                | Optional selected-provider credentials                      |
| CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN   | Optional Workers AI credentials                             |
| PEXELS_API_KEY / RESEND_API_KEY                | Optional stock/email provider credentials                   |
| AI_FEATURES_ENABLED / IMAGE_GENERATION_ENABLED | Default off; quota and entitlement still required           |

Set explicit connection/request timeouts and pool/concurrency limits in validated configuration.
Implementation may rename variables for SDK conventions, but must update the schema, examples,
operations guide and CI together. Do not expose secrets through NEXT_PUBLIC variables.

Missing required production values must fail startup without printing them. Missing optional AI
keys disables the feature. Readiness reports dependency status without leaking connection strings.
Store production secrets outside the repository and application releases with restrictive permissions.
Do not copy demo passwords, development defaults or CI test secrets into production.
