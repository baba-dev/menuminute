# POS 3.0 — Core finance hardening (issue #142, Phases A–D)

Status: **review candidate**. The existing production cashier path is the operational authority, not a gateway/certified fiscal invoice. This slice does not activate `pos_finance_gates`, Stripe, statutory invoices, or a second POS.

## A — Current contracts and invariants

The canonical `orders` row owns kitchen/fulfillment status. `pos_sales` owns the immutable sale-to-order relation; `pos_bills` freezes a separately approved non-fiscal tax profile. `pos_staff_payment_attestations` (migration 0039) is the always-available cashier **Mark as Paid** record. `pos_tenders` is the separate, operator-gated finance path with partial and mixed methods, `pos_refunds` and `pos_credit_groups` document backed corrections, and `pos_provider_attempts` holds external uncertainty. None may be silently rewritten into another source.

A single **outlet-scoped, protected read projection** joins the staff and finance worlds without copying or moving historical money, and never treats staff-recorded card/UPI/bank entries as provider-confirmed receipts. Deny direct authenticated table reads; use the established `app_private.pos_access` permission check and scoped `SECURITY DEFINER` functions. Historical finance read/print must remain accessible when new collections are disabled.

Payment states are independent:

- `unpaid`, `partial`, `paid`, `refunded`: computed allocation status based on known source records, not an assertion of bank settlement
- `staff_recorded` vs `provider_confirmed`: evidence strength, never implicitly upgraded
- `frozen_bill` vs `pre_tax_draft`: tax/legal meaning; no cross-basis arithmetic claims

Refunds do **not** modify the original attestation, tender or issued document. Full staff-attestation correction is a distinct append-only compensation; non-cash correction requires an explicit staff attestation of external refund already performed. No synthetic gateway refund or fiscal credit document is issued, and unsupported partial line staff-attestation refunds are out of scope. The existing operator-gated partial finance refunds and provider webhooks retain their current authority.

## B — Read projection

`app_private.pos_settlement_detail(outlet_id,sale_id)` is a protected private read with explicit outlet scoping. It exposes the sale basis, separate staff/finance totals, money collected vs refunded, cash attributions and evidence quality; never claims a bank reconciliation or legal tax calculation. Access to another organization's sale returns a denied/missing result without customer rows.

## C — Verified integer accounting

Use strict positive integer minor-unit strings, fail on overflow/nonintegral inputs and enforce exact cash change vs noncash tendered equals applied. Define deterministic amount allocation, proportional discount apportionment and tax half-up arithmetic in pure functions with independent fixtures for 0/2/3 currency exponents. Tax math is **not** regulatory classification approval and does not change the current SQL `pos_preview` or authorize statutory invoices. Discounts are a tested internal calculation primitive, not a newly enabled POS discount capability.

## D — Corrections and concurrency

Allow an authorized manager to record one **full staff-attestation refund/correction** without any payment provider or finance activation. A new immutable `pos_staff_refunds` row is scoped to the original sale and staff attestation. Same request key and matching payload return the original result; conflicting keys, two managers and stale/outlet-swapped sales cannot refund twice. A full correction updates the coarse canonical order payment status to `voided` and emits an auditable `order.payment_changed` event in the same PostgreSQL transaction. This does not cancel kitchen fulfillment, issue a fiscal credit, or call a gateway. POS receipts must show **Refunded**, not a misleading Pending/Paid state, after full correction.

## Review and release gates

- No existing migrations (0000–0045) edited; additive migration numbers and immutable journal order only.
- PostgreSQL integration: same key replay, competing keys, full staff payment without finance gates, owner/manager allowed vs cashier restricted refund, cross outlet denied, direct table access denied, receipts and ledger projections after refund, existing split tender/provider credit regression.
- Calculators: exact 0/2/3 exponent results, discount partition preservation, tax rounding and over/under tender cases; no floating point money logic.
- Exact-head six-lane ARM64 CI, real PostgreSQL/Redis, static analysis and Playwright; manual accountant/security review required before merge.
- No automatic operator payment, tax, fiscal, pricing or Kitchen Pro activation. Manual fiscal approval and independent revenue reconciliation remain issue #142 follow-up work.
- Shared VPS backup/restore limitations documented separately in issues #131/#49; CI green is not disaster-recovery evidence.
