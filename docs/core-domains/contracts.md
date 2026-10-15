# Phase 2 contracts v1

Base: merged Phase 1 #15. Runtime changes follow these producer boundaries.

- Administration uses a freshly verified Actor and explicit organization selector. Commands lock the
  organization row, recheck current authority, verify expected version, apply changes and persist
  audit + outbox + idempotent command result in one PostgreSQL transaction. No network I/O inside.
- Owner alone controls organization suspension/reactivation, ownership transfer and billing. Admins
  manage non-owner members/brands/outlets. Outlet managers may assign existing organization members
  within their own outlets and only roles contained in their effective permissions. No implicit admin.
- Staff join through existing-account assignment; this phase does not send email invitations.
  Role/active-state edits retain history. Currency changes on priced/history-bearing outlets require
  a later explicit repricing workflow; type/name/mode changes preserve QR and historic order data.
- Organization version serializes administrative changes. Requests include UUID key, expected
  version, action and validated payload; reuse with a different command conflicts. Command results
  are retained durably, not cached authorization. Every retry still resolves current authority.
- Domain events contain durable ID, schema version, organization/outlet, aggregate version and a
  bounded server-generated summary. Queue jobs only carry IDs/scope/attempt and a monotonic delivery
  sequence, never authority or secrets.
- Dispatcher claims finite leases with SKIP LOCKED, enqueues outside SQL, and conditionally acknowledges
  its lease. Unreceipted dispatches become eligible again after a deadline; Redis loss is recoverable.
  Consumer effects and receipts commit together. The initial consumer maintains a versioned domain
  projection; no external email/payment/AI side effects are enabled. External consumers will require
  provider idempotency and ambiguous-result reconciliation before registration.
- Worker credentials are distinct from the web and migration owner. Workers can access only durable
  delivery/projection state, not auth credentials or merchant tables. Current scope comes from the
  stored event; queue data cannot grant privileges. System projection updates remain valid after
  actor revocation, including suspension invalidation; delegated user jobs are not implemented here.
- Entitlements are explicit operator-issued grants for new ordering/kitchen capability, with UTC
  start/end and revocation. Only the owner reads billing state. Grants do not process payments and
  require explicit USD/INR billing currency; outlet currencies remain independent. Free menus/QRs
  do not depend on grants. Accepted work completion must not use a new-work entitlement gate.
- Exact prices, bundles, quotas, trial/grace, collection provider and jurisdiction policy remain
  undecided. No legacy plan row automatically becomes paid authorization.

Migration: additive tables/columns and policies, no source/history deletion. Apply with migration
owner after provisioning a restricted worker role. Old web remains schema-compatible; stop/drain the
new worker before rolling back its executable. Never drop durable work/grants/audits as a rollback.
