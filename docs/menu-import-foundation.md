# MenuMinute — Smart Import foundation (PR A)

Status: foundation only. No AI requests, processing trigger, menu mutation, publication or UI entry point. The marketing photo import remains **coming soon** until the later packages pass production acceptance.

## Scope and route contracts

- `POST /api/menu-imports` creates an authorized `collecting` session with a browser-generated UUID `id`, independent UUID retry `key`, and optional `targetMenuId` (null for new menu). Safe repeat returns 200; first create 201.
- `GET /api/menu-imports` lists most recent 25 sessions scoped to the selected outlet; `GET /api/menu-imports/{importId}` shows sanitized metadata and any future candidate.
- `POST /api/menu-imports/{importId}/sources` takes binary static JPEG/PNG/WebP with `Origin`, `x-import-source-id` UUID and zero-based `x-import-page-index`. 5 MiB/request, 12 pages/session, 30 MiB aggregate reserved original bytes, 30 source reservations/hour/outlet, at most 30 retained source objects/outlet (5 MiB output ceiling each; worst-case 150 MiB, including cancelled sessions), 10 megapixels. It re-encodes and rotates into private WebP and strips metadata. Same source UUID+bytes retries safely; changing payload/page conflicts.
- `GET /api/menu-imports/{importId}/sources/{sourceId}` streams authenticated private WebP with no-store and rechecks authority after reading storage.
- `POST /api/menu-imports/{importId}/cancel` accepts JSON `{ "expectedRevision": 1 }`; stale revisions reject, identical completed cancellation reconciles.

All routes use the existing session and outlet authority, and mutation origin is enforced. No direct tenant selector supplied by the request is trusted without membership checking.

## Storage/operational contract

- Local deployment: `MEDIA_STORAGE=local`, `MEDIA_ROOT` is the existing private persistent media root, outside release/public. Separate namespace: `imports/<organization>/<import-uuid>/<source-uuid>.webp`. The new key grammar is deliberately separate from approved public dish media.
- No public source URLs, no automatic deletion, no cross-tenant media sharing, no client-supplied filesystem keys. Atomic hard-link commit never replaces previous source content, including lost-response retries. Finalization in PostgreSQL is independent of filesystem effects. If an outage/cancellation occurs between private PUT and SQL acknowledgement, the reserved row and possible orphan remain private and recoverable for operator reconciliation.
- Before activation, validate actual `menuminute-media` shared-group/ACL on the host. R2 live import source support is not implemented; when `MEDIA_STORAGE` is not local the feature fails closed rather than writing into a release directory or an unconfigured path.
- Back up matching SQL and import sources, define retention and audited garbage collection in a later package. This PR never deletes bytes or revisions.

## Status contract

`collecting -> queued -> processing -> needs_review -> ready -> applied`; `cancelled`, `failed`, `expired` are terminal/recovery statuses. PR A exposes only create, upload and cancellation; it does not expose queue/candidate/application actions. Candidate v1 allows null/uncertain prices and source evidence but is not a publishable MenuDocument. Candidate table has RLS read-only grants to app; future worker writes need explicit scoped security-definer commands. Imported prices and dietary facts cannot reach ordering/public menu from PR A.

## Migration and release

**Approved journal sequencing for this release:** the currently applied main history is `0000`–`0006`. Auth PRs #96/#99 remain draft and are **not** a prerequisite for this independent foundation. This PR appends the new, immutable `0009_menu_import_foundation` file as journal entry `idx: 7`, with all existing seven entries and historical SQL unchanged. The repository's owner-only runner executes `entries[].tag` in journal order; the installed v4 helper compares prefix order and existing file bytes, not numerical filename sorting. After this foundation becomes an applied migration, Auth PR #96 must integrate the new main and append `0007_verified_identity` as `idx: 8`; stacked #99 must then append `0008_auth_security` as `idx: 9`. Their existing draft journals (which put auth at idx 7/8) **must not** merge or deploy unchanged. Those filename numbers are reserved labels rather than chronological execution positions. Never rewrite the applied import SQL or reorder historical journal entries to make the file numbers visually ascending.

Run real PostgreSQL/Redis tests and exact-head four-lane ARM64 CI; independently review final diff. Activation with a changed migration requires helper v4, private migration-owner connection, a new verified off-host backup and live eligibility/ERP/readiness preflight. Confirm private media shared-group ACL. An activation failure does not authorize schema rollback. Web and worker need schema compatibility when future worker jobs are enabled.
