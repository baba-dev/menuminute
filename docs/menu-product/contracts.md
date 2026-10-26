# Phase 3 — Free QR Menu contracts v1

Base: merged #19, dd39ef4. Work package #10; root is the sole schema/layout/worker writer.

- A menu belongs to one organization, has an originating outlet and explicit currency. Categories,
  dishes, variants and flat add-on groups have stable IDs. Money is integral minor units. Nested
  combos and size-dependent add-on calculations remain undecided; no ordering is enabled here.
- Draft revision is independent of its immutable published release. Saving never changes the live
  document. Publishing validates current media approval and every assigned outlet's permission and
  currency under the organization lock. Commands carry expected revision and UUID retry key.
- Brand/outlet assignments stay within the organization and existing brand/outlet links. Shared
  edits require menu.write at every affected outlet. Local overrides are explicit price/sold-out
  overlays, not a currency conversion. Renaming/type/menus/entitlements never rotate QR identity.
- Weekly windows use outlet wall time, start-inclusive/end-exclusive. End earlier than start crosses
  midnight; equal endpoints require explicit allDay. Date exceptions replace that calendar day,
  including carryover into a closed exception. DST follows the actual instant's local clock; this
  browsing schedule is not an order-expiry or scheduled-pickup contract.
- A menu/dish may be draft, published, scheduled, sold out or archived. Public browsing labels
  outside-window dishes and sold-out states without enabling ordering controls. Manual dietary
  statements remain merchant supplied; no ingredient/allergen inference.
- Private original uploads use bounded bytes/pixels, server-derived keys and reserved storage budget.
  PostgreSQL records upload/queue/processing/ready/failed state before external I/O. Workers recheck
  stored actor authority before processing and finalization. Only re-encoded, approved derivatives
  referenced by an active published menu are public. No remote URL downloads, SVG uploads, provider
  calls or automatic publication. Local fallback illustrations remain immediate and deterministic.
- Menu commands, releases, QR lifecycle, media approval and delivery intent commit with audit/outbox.
  Public menu documents remain dynamic/no-store. Photo responses use private browser revalidation:
  every request rechecks publication and approval, while a matching ETag returns an authorized 304
  without reading object bytes. Revocation never depends on Redis/cache invalidation. The outbox
  remains a recovery/notification boundary, never the authorization source.
- Additive migration and executable rollback preserve released documents, QR tokens, source data,
  receipts and media objects. No destructive cleanup or production deployment is included.

Acceptance includes real PostgreSQL/Redis failure/race tests, native ARM64 builds, browser editing,
preview/publication, public filtering, QR and media flows in Light/Dark/System, keyboard and mobile.

Local base-price overrides apply only to dishes without variants; variant dishes may override sold-out status locally. Clear existing local prices before introducing shared variants. Unavailable required add-ons can be saved; dishes with too few available required options or no available variants are displayed sold out.
