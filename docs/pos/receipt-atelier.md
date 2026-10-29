# The Till: Receipt Atelier and Staff Payment Lifecycle

Status: implementation contract for a feature PR against current `main`. Do not equate a merchant's operational payment attestation with a verified electronic payment or tax invoice.

## User journey

- In 03 / ORDER PAD, **Mark as Paid** is always visible once draft POS is enabled and is not dependent on finance gates, tax setup, payment gateways, or POS subscriptions. It is unchecked for every new ticket.
- Optional payment method (cash, cashless external UPI/card/bank, other) is an operator **attestation only**. It must never initiate or imply provider settlement.
- **Print Invoice** is a compact checkbox. Its preference is scoped to the browser terminal and active outlet; a fresh ticket retains this preference.
- After the canonical order is submitted, the operator receives one second of green success feedback, then a neutral button. Known failure gives red feedback and an accessible persistent explanation; unknown results must be retried with the original command key, not announced as a confirmed failure.
- Clicking Send to Service Counter always performs the same kitchen/order action regardless of payment/print flags. If printing is selected, the resulting sale prints through an authenticated 58/80mm receipt route with a browser dialog. A blocked dialog has a clear open/retry link. Printing failure must not alter the sale's status.
- Section 04 / DRAFT REGISTER uses **real server-backed pagination** (10 rows/page), outlet-scoped, with previous/next, bounded offsets and an accurate total.

## Canonical state and finance boundary

- `orders.payment_status` is the canonical operational field and becomes `paid` when the staff attestation is transactionally committed with the new POS order.
- The staff attestation has immutable outlet/sale/order/actor/method/amount/currency evidence. Its amount is the server-priced **pre-tax** draft subtotal. There is no payment-provider proof and no legally computed tax amount. A failed attestation must roll back the creation of the order.
- A POS sale marked paid by this shortcut may **not** be collected again through the finance tender ledger. Explicit accountant-reviewed migration/reconciliation is required before entering a fiscal workflow.
- A pending receipt is a provisional unpaid bill. A staff-paid receipt is a **staff-recorded payment acknowledgment**. Neither is a tax invoice, approved fiscal receipt, final tax determination, or a gateway confirmation.
- Already issued finance documents remain immutable and must continue to use Ledger's original document endpoint and serials; no extra issue operation is triggered by printing.

## Security, retries and devices

- All reads and writes are current actor + outlet scoped by the same `app_private.pos_access` permission contract. No publicly accessible receipt token; no direct DML on payment evidence.
- Same submit request key + payload yields the same sale and its attestation, including network retry. Changed intent conflicts. A new print window never resubmits a sale.
- Receipt HTML is private, no-store, noindex, escapes user text, and draws only authoritative sale/line/merchant data.
- Browser printing is the guaranteed fallback. Silent USB/network printing requires an explicitly installed/trusted local bridge and must not be described as browser-native or enabled silently.
- CSS must support 58 and 80mm print widths, monochrome, long names, low-paper waste, phone screens and reduced motion.

## Release

- Additive SQL after the current migration journal; preserve existing finance-gate controls and old order semantics.
- Validate strict TypeScript, formatting, unit/integration tests in real PostgreSQL, tenant isolation, duplicate submit, failure recovery, receipt access and server pagination, Playwright and exact-SHA ARM64 CI.
- PR merge does not activate fiscal adapters or deploy to the VPS. No ERP configuration changes.
