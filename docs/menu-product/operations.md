# Phase 3 — Operation, evidence and rollback

This implements the free QR menu product. Ordering, guest carts, payment collection, AI, stock image
search and automatic publishing are not enabled. Artwork #4 and CSV #16 remain independent work.
Commercial prices, trial/grace and complex modifier calculation rules are unchanged.

## Migration and legacy continuity

Apply additive migrations 0004–0005 as the migration owner after the Phase 2 worker role exists.
They add menu drafts/releases/assignments/overrides, private media state, RLS and checked RPCs.
Existing applied migrations remain immutable. Newly provisioned organizations get a default brand,
outlet, empty menu draft and permanent QR in one transaction. Onboarding confirms type, currency,
timezone, supported modes and an optional first-menu schedule. Older outlets retain their legacy
public menu until first versioned publication. Menu Studio can copy the old catalog into a draft;
this does not delete legacy rows or alter a live menu. Once versioned publication begins, unpublishing
never exposes an older legacy catalog. Re-publication restores the same QR destination.

A shared menu has an explicit currency and scoped brand/outlet assignments. Cross-currency reuse
requires an explicitly repriced menu, never automatic conversion. All shared document changes require
current menu.write at every assigned outlet. A local price/sold-out overlay affects only its assigned
outlet and checks local authority. Printed QR identity survives menus/name/type/billing changes.
Regeneration/revocation is organization-admin-only; revoked rows remain as history. Regenerating the
canonical main code updates its canonical pointer while retaining the old revoked QR record. Table
and counter labels provide context, not ordering authority or physical-presence proof.

Drafts, published revisions and archives remain distinct. Publication holds the organization lock,
checks expected revision/current authority/currency/approved media, writes immutable release, audit and
durable outbox in one commit. Reused keys reconcile their committed result after authority checks.
Public menu and photo responses are dynamic/no-store; availability or revocation does not depend on
cache Redis or a worker invalidating a cache. A future CDN cache must add versioned invalidation
before changing this contract. Browsers refresh public data every 30 seconds and label offline/stale
content; there is no offline order queue. Saved drafts and entered fields survive request failures;
a stale edit can explicitly reload the saved version rather than silently overwrite another editor.

## Private media storage

The web and worker need the same explicit store configuration. Choose one:

- `MEDIA_STORAGE=local`, with an absolute `MEDIA_ROOT` outside release/public directories, owned by
  the runtime account and private mode. Back up both SQL and this persistent volume. For separate
  web/worker Unix accounts, configure a reviewed shared group/ACL for this directory; do not grant
  runtime write access to immutable releases.
- `MEDIA_STORAGE=r2`, `R2_ENDPOINT=https://<account>.r2.cloudflarestorage.com/`, `R2_BUCKET_NAME`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Use a private bucket and bucket-scoped credentials.
  Originals and derivatives are never public bucket objects. Requests use SigV4, auto region,
  SHA-256 body hashes, canonical account endpoint, bounded reads, timeout and no redirects.
  Do not configure R2 custom-domain/public URLs here. No provider calls occur without explicit mode
  and operator credentials. No paid fallback, inference or stock search is implemented.

For the selected Oracle ARM64 local-media deployment, pre-create `MEDIA_ROOT` as
`root:menuminute-media` mode `2770`, and add both service identities to that group.
The local adapter creates nested directories with mode `2770` under the setgid root, and files
with mode `0660`; systemd must set `UMask=0007` and
`SupplementaryGroups=menuminute-media` for both processes. Under `ProtectSystem=strict`,
only the web and worker's required private runtime directories are listed in `ReadWritePaths`.
Do not put original media under a public or release directory, or give either process migration
secrets. Pre-existing directories made under an older `0700` layout need an explicit audited
migration; a new `mkdir(recursive)` does not repair them. Validate the real separate-account
cross-read smoke test on the host prior to enabling uploads.

Set `MEDIA_OUTLET_BUDGET_BYTES` explicitly for production (default local/test reservation 100 MiB).
This is an operator storage protection, not a promised commercial plan quota. Reserve original bytes
in SQL before storage writes; retained bytes count toward the budget, including failed uploads.
A 30-upload/hour/outlet operational request limit, 5 MiB/file, 10 megapixels, static JPEG/PNG/WebP
signatures and 600 KB menu request limit bound work. Allow storage/CPU headroom for derivatives,
concurrent decodes and retained failed originals. Do not advertise unlimited media storage.

The upload route never publishes originals. The durable media event contains an opaque media ID;
the isolated worker resolves scope from SQL and rechecks the stored actor before processing and
finalization. It validates actual raster signatures/decoding, rejects SVG/animated inputs, rotates,
strips metadata and writes WebP display/thumbnail derivatives with fixed keys. Effect + receipt and
audit/outbox commit together. Only ready, explicitly approved derivatives referenced in an active
published menu are served. Unapproval/suspension/unpublication blocks new reads immediately.
Missing images fall back to the local category illustration, without external network calls.

A crash after private storage PUT and before queuing leaves a durable uploading row. The worker's
bounded reconciler queues rows older than two minutes. Missing storage is retried within the durable
budget; malformed media/revoked authority ends as failed without public bytes. Network/storage
failure preserves the current published photo. No automatic deletion or garbage collection runs in
this phase. Operators review failed/unreferenced objects and retention before any cleanup; never
remove an object still referenced by a released menu. There is no claim of exact-once external I/O;
retries write deterministic derivatives, while receipt-protected SQL effects commit once.

## Worker release and shared host

Build on Linux ARM64 with frozen dependencies. `pnpm build` creates the web release;
`pnpm build:worker` creates the separate worker entry. Follow Phase 2 packaging: external production
packages including sharp/pg/BullMQ must exist in the ARM64 worker release. Worker gets only its
restricted SQL credential, queue Redis URL and media storage settings; never migration/auth secrets.
The browser harness uses isolated test-only synthetic client IDs for authentication rate-limit
separation; this proxy is not a production forwarding configuration. Authentication limits are unchanged.

Review worker memory/CPU budgets against bounded Sharp decodes and measured ERP peaks before
installing. Local storage requires shared filesystem/ACL access, or use configured R2. Existing
systemd units are templates, not an installed release. Align backup retention, restore, disk/object
storage monitoring and error/backlog alert destinations before public launch. Production R2 account
permissions and live storage smoke/restore evidence remain operator release gates; CI uses local
storage plus mocked R2 protocol tests and makes no live provider calls.

## Rollback

Stop/drain the new worker before rolling back executables. Keep all additive tables, immutable
releases, QR records, originals, derivatives and migration ledger. Earlier executables cannot render
the versioned menu model: restoring the Phase 2 public executable alone would expose its old catalog
for published outlets, so pause public traffic or keep the Phase 3 read/QR-serving compatibility path
until a reviewed forward fix. Never drop data or reset publication flags as a shortcut. Restore SQL
and media together only through the approved backup/restore procedure after assessing newer writes.
No deployment or host configuration is performed by this PR.
