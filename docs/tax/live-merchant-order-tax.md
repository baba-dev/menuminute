# Merchant sales tax on live orders — issue #315

**Status:** Source integration. A migration/CI merge does not constitute production release or statutory GST/VAT certification.

## Rollout and merchant consent

Migration `0107_live_sales_tax` adds `apply_to_orders BOOLEAN NOT NULL DEFAULT FALSE` to pre-existing outlet tax policies. **All previously configured tax rates remain preview-only** until an authorized merchant explicitly checks *Collect on new orders*, accepts legal responsibility and saves a new policy revision. Saving and opt-in are independently audit-logged. An authorized owner/manager may turn collection off by saving the policy with `applyToOrders:false`.

The merchant's declaration is **not** proof of tax registration or authority to collect. For India the order-commit guard requires a registered POS seller with matching country and per-dish POS tax classifications matching the declared rate and inclusive flag. A configured generic rate is never a substitute for India GST statutory classification; ineligible or inconsistent configuration refuses checkout. Additional country jurisdictions require qualified tax review before activating local collection.

## How quotes and commits work

Public QR checkout uses a scoped, rate-limited `/api/public-orders/tax-quote`. Cashier POS uses authenticated `/api/organizations/:org/outlets/:outlet/pos/tax-quote`. Neither endpoint grants authority over prices or finance. Both expose only the label, rate, inclusive flag, policy revision, currency and opt-in state.

All cart amounts remain tentative. On submit, MenuMinute independently verifies published menu and options; then the existing trusted guest/POS SQL producer reconfirms those prices, service hours, customer/source limits and idempotency. A final SQL function locks the merchant policy transactionally, recomputes integer-minor-unit inclusive/exclusive tax for **each committed order item**, checks the expected revision and payable amount, freezes every line and policy setting in a private immutable snapshot, and updates the canonical order and `order.created` event **before the transaction commits**. A mismatch raises a conflict and writes no new order/payment.

For guests submitting to the Free tier, the same existing per-outlet monthly order cap and replay checks continue to run. A committed idempotency key replays its original amount even after later menu/tax changes; it must not create a second order or charge.

Numeric representations are 0/2/3 (and other ISO-defined) decimal currencies; arithmetic uses integer minor units and per-line half-up rounding. There are no floating-point financial computations or silent client-supplied tax overrides.

## Private non-fiscal receipts and refunds

POS staff `Mark as Paid` captures the **final payable amount**, including frozen merchant tax, rather than the pre-tax sale subtotal. Existing staff-payment evidence remains a local attestation, never a gateway settlement claim. Staff refund compensation uses that exact original payment amount; a POS receipt reads the original order's frozen tax label, policy revision, taxable base and paid total, even if the merchant later changes the tax policy.

POS finance bill-freeze cannot reclassify an already tax-paid order to a different total without explicitly reconciling against its frozen order snapshot. Historical receipts without a tax snapshot retain their earlier pre-tax/non-fiscal amounts. No automatic data backfill mutates past finances.

**This does not activate statutory tax invoices, IRP, signed QR, legal credit notes or government filing under #226.** These remain independently gated.

## Operational release checklist

- [ ] Exact-head TypeScript, lint, native ARM64 compilation, scanning, real PostgreSQL and both Redis instances, production browser shards and required release gate all green.
- [ ] Manual reconciliation for local and international Free, paid, POS cash and external staff-recorded tenders; 0, 2, 3 decimals and both inclusive/exclusive.
- [ ] Multi-terminal policy revision race, duplicate/replay after timeout, unavailable dishes, client version mismatch and free monthly cap.
- [ ] Staging upgrade from latest applied journal 0106 to 0107 using an isolated restore and verified pre-migration backup, plus ERP health checks and rollback procedure.
- [ ] Sample 58/80mm original and refunded receipts from printers, not just browser render; private receipt emails and reports reviewed against immutable original amounts.
- [ ] Independent financial and security review, tax registration/classification review, release owner and production signoff.
- [ ] Deploy migration before web code; verify exact web/worker SHA and migrated database version, then explicitly activate only reviewed merchant outlets.
- [ ] Do not enable statutory invoices or payment-gateway charging via this change.

Do not drop private tax snapshots to roll back a configuration. Disable `apply_to_orders` via an audited new policy revision; preserve all historical amounts, payment attestations and original receipt evidence.

Related: issue #226 statutory GST invoicing (still closed for issuance), issue #315, migrations 0104 and 0106.
