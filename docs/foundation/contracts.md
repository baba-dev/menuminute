# Phase 1 producer contracts v1

Phase 1 started on PR #14, which has since merged. This contract precedes the runtime conversion in the branch.
No production cutover or server modification is authorized by these files.

- `Actor = { userId: string }` is constructed from a freshly resolved Better Auth database session,
  never from request JSON. No session cookie cache or JWT membership authority.
- `withOutlet(actor, outletId, permission, callback)` acquires one bounded PostgreSQL transaction,
  sets actor and outlet context with transaction-local `set_config`, checks current membership and
  scoped roles, then exposes the transaction to the domain callback. Rollback clears context too.
- `restaurants` is the compatibility name for outlet rows, not the tenant boundary. Every outlet
  belongs to an organization. Brands and outlets link within one organization. Organization roles
  owner/admin are distinct from per-outlet manager/service/kitchen/menu-editor role arrays.
- Domain queries/mutations accept Actor and outlet selector, enforce service permissions and RLS;
  cross-tenant relationships use composite foreign keys. Missing context denies tenant SQL access.
- Public reads execute one fixed, security-definer projection by stable QR token, never set a public
  bypass flag or select arbitrary private tables. No public write/order API lands in this phase.
- Organization provisioning validates input, prepares QR rendering outside the transaction, then
  atomically creates organization, owner membership, brand, outlet and QR identity. No provider I/O
  inside the transaction. The narrowly scoped provisioning function owns its writes.
- Migration connection owns schema; runtime role cannot be owner, superuser or BYPASSRLS. Auth tables
  are accessible only to the trusted server role; organization access remains domain policy rather
  than a second Better Auth organization membership authority.
- SQL timestamps are UTC timestamptz. Monetary compatibility fields retain legacy names temporarily
  but contain integer minor units; currency exponent is resolved from ISO catalog. No tax/rounding
  or order calculation rules are invented. Ordering and BullMQ dispatch remain subsequent slices.

## Cutover

The repository is a scaffold; actual host data inventory remains a release gate. Never infer no
real users from the absence of a deployed app in this checkout. Preserve and import a consistent
SQLite backup in staging, reconcile rows/IDs/QRs/accounts and hash verification, then rehearse a
write pause. Old NextAuth sessions must be explicitly invalidated; imported credential hashes keep
password compatibility. Do not silently discard unsupported data or normalize colliding emails.
Rollback before new writes restores the source snapshot/app; after new writes use forward repair or
reconciled restoration. Source SQLite is read-only migration input, never a runtime fallback.
