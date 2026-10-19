# MenuMinute — Smart Import foundation (PR A)

Status: foundation only. No AI requests, processing trigger, menu mutation, publication or UI entry point. The marketing photo import remains **coming soon** until the later packages pass production acceptance.

## Scope and route contracts

- `POST /api/menu-imports` creates an authorized `collecting` session with a browser-generated UUID `id`, independent UUID retry `key`, and optional `targetMenuId` (null for new menu). Safe repeat returns 200; first create 201.
- `GET /api/menu-imports` lists most recent 25 sessions scoped to the selected outlet; `GET /api/menu-imports/{importId}` shows sanitized metadata and any future candidate.
- `POST /api/menu-imports/{importId}/sources` takes binary static JPEG/PNG/WebP with `Origin`, `x-import-source-id` UUID and zero-based `x-import-page-index`. 5 MiB/request, 12 pages/session, 30 MiB aggregate reserved original bytes, 30 source reservations/hour/outlet, 150 MiB retained source reservations/outlet (including cancelled sessions), 10 megapixels. It re-encodes and rotates into private WebP and strips metadata. Same source UUID+bytes retries safely; changing payload/page conflicts.
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

Append-only `0009_menu_import_foundation.sql`; historical SQL unchanged. Auth PRs #96/#99 currently reserve 0007/0008. Before merge, reconcile the journal by appending #96/#99 entries first if they land, then this 0009 entry; keep already-applied migration order and checksum immutable. This branch must not be merged blindly ahead of in-flight migration ownership. Run real PostgreSQL/Redis tests and exact-head four-lane ARM64 CI; independently review final diff and validate live SQL+media backups, ERP coexistence and permission revocation before host activation. Web and worker need schema compatibility when future worker jobs are enabled.
