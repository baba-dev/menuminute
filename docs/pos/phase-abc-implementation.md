# POS A–C implementation handoff

This document records executable scope on branch
`feat/pos-a-b-c-financial-foundation`, tracked by [#142](https://github.com/baba-dev/menuminute/issues/142)
and integrated in [PR #145](https://github.com/baba-dev/menuminute/pull/145).
Do not confuse a merged PR, passing CI or a schema migration with an activated fiscal POS.

## A — financial identity and API boundary

- Authenticated owner/admin seller profile, with legal name, registered address, outlet country,
  optional self-declared registration number, and explicit tax-review state.
- No tax verification or government registration is performed by these fields.
- POS permission is **independent** of owner-only `billing.manage`: current owner/admin,
  or assigned outlet manager/service staff for reading and creating drafts.
  Only owner/admin can configure the outlet.
- Draft POS opt-in defaults to off for every existing and new outlet. No background activation.
- Web routes are private/no-store and the Till has noindex metadata.
- Outlets must publish a versioned menu and have an active QR before creating staff food orders.

## B — durable restricted schema

- Additive migration: `src/db/migrations/0017_pos_foundation.sql`.
- New tables: `pos_outlet_settings`, `pos_seller_profiles`, `pos_sales`,
  `pos_sale_lines` and `pos_commands`.
- Composite organization/outlet and outlet/order relationships and a unique outlet/order sale
  association prevent tenant crossing and duplicate attached source tickets.
- No direct financial-table privileges for the web/worker roles. Every read/write runs through
  a live-member checked, scoped `app_private.pos_*` entry point.
- Draft amounts are snapshotted from canonical order items, in minor units.
  Monetary movement and invoice issue tables are not part of this phase.
- A same-key, same-payload retry is recoverable even if the menu changes after the original
  successful commit; a changed payload with that key conflicts.
- Legacy `record_order_payment` explicitly rejects POS-linked draft orders.
  Unrelated historical/guest order payment behavior is preserved.

## C — operational integration

- `/dashboard/pos` is the responsive Ink & Ember Till.
- Configure seller identity, select a published menu and food variants/add-ons, select fulfillment
  and optional table, review a pre-tax cart, then create a canonical pending unpaid order.
- The service and SQL both revalidate menu revision/fingerprint and SQL recomputes published
  variant/add-on prices, quantity limits and request totals before insertion.
- A staff order inserts its canonical order, immutable item snapshots, initial status event,
  POS draft/line records, domain audit and `order.created` outbox event atomically.
- The Service Counter accepts the resulting pending ticket. Existing Kitchen Pro processes
  its accepted work normally: no second kitchen command, no duplicate ticket.
- An accepted/active/completed unpaid QR order can be attached to one POS draft exactly once;
  this operation does not submit another food order or outbox `order.created`.
- Recent draft sales and eligible unlinked tickets are bounded to 30 per query.
- Staff submission checks the published item schedules at quote time and stores a bounded,
  outlet-local pending expiry. POS has no offline-financial write mode.

## Explicit limits and release gates

The Till is an **unpaid, pre-tax operational draft recorder**. The subtotal is not a tax-complete
bill. It does not receive, initiate, confirm or reconcile any customer payment; issue receipt,
invoice or e-invoice; apply discounts; process returns; close a shift; or synthesize history
from old `orders.payment_status`. Those require D/E, approved local tax policy and separate finance
security review. Do not claim tax-compliant invoicing from A–C.

A staged rollout must verify current operator entitlement/approval, seller identity, access
matrix, exact-sha ARM64 CI, SQL compatibility, durable off-host backup/recovery, ERP HTTP 200
before/after deployment, and the ability to disable new POS work without losing old records.
Merging the PR never enables a merchant outlet by itself.

### Required test evidence

- `tests/pos-contracts.test.ts`: strict input and tax-identity declarations.
- `tests/pos.integration.test.ts`: migration/RLS, canonical staff order, SQL-side idempotency,
  existing order attachment, tenant denial, legacy settlement block and audit/outbox.
- `tests/e2e/pos-till.spec.ts`: real browser auth, seller opt-in, selection and draft order.
- Full typecheck/lint/format/unit/integration/build/E2E on the final PR SHA.
  Record exceptions in the PR and keep it draft until resolved.
