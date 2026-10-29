# Receipt Atelier: operational release and device validation

## Current implementation

Phase A–H feature PR: operator attestation is transactional with POS order creation, evidence is append-only, and the canonical order payment status is set without a payment gateway. Checkout from the normal finance tender pathway remains separately gated. All printed non-issued documents are explicitly non-fiscal and show pre-tax subtotal, not tax-complete payable.

Print Invoice in 03 / ORDER PAD is a **browser print** preference, stored per browser/outlet. A new tab is reserved in the actual click gesture and opens the private printable bill after the order succeeds. The OS/browser manages the real printer, with a visible manual print option if the automatic dialog or popup is blocked. No silent printer connectivity is claimed; USB/Bluetooth/local-network direct printing remains an optional future locally installed, authenticated bridge integration.

The selected order can always be manually reprinted from Section 04 / DRAFT REGISTER or The Ledger. If a fiscal original has been legally issued through the existing finance subsystem, the receipt route redirects to the immutable original print view. Printed operational receipts never allocate fiscal serials.

## Rollout gates

1. Review migration `0039_till_receipt_atelier.sql` and journal compatibility with current production head. Take verified off-host encrypted backup before any migration. Do not alter historic migration hashes.
2. Run formatting, lint, strict typecheck, Node/Vitest tests, real PostgreSQL integration, Playwright/browser and ARM64 build on the final head SHA; do not infer success from PR creation.
3. Ensure no operator payment-provider activation occurs. Staff-acknowledged payment is an **attestation**, not provider verification, VAT/GST calculation or a tax invoice.
4. Verify concurrent same-key submissions produce one order and one payment record. Check cross-outlet denial, financial ledger double-collection guard and outbox delivery. Receipt failure must never undo or repeat the financial/operational event.
5. Validate 58mm and 80mm in actual supported printer drivers: paper width, margins, line wrapping, pagination, footer cutter feed, monospace/Unicode coverage, receipt length and correct currency precision (including 3-decimal OMR).
6. Test browser popup blocked, print dialog dismissed, storage denied, network offline/unknown submit result, back/forward navigation and both mobile themes. Screen reader error text must persist beyond transient button coloring.
7. Verify a staff-attested POS sale cannot later receive a finance tender without an explicit reviewed reconciliation. This is deliberate double-collection protection; do not silently backfill fiscal documents.
8. Keep unrelated shared-host ERP and Kitchen Pro untouched. Rollback application code if needed without deleting existing payment attestations or issued documents; do not roll back by deleting financial evidence.

## Known limitations

- No direct/silent QZ/ESC-POS print bridge shipped by this change; OS browser printing is necessary for this implementation. Future direct printing needs local driver pairing, pinned dependencies, signed requests, a secure trusted terminal pairing process, and paper-out/delivery uncertainty reconciliation.
- Operational staff-paid amounts are pre-tax. They must not be presented as government-valid tax receipts or a gateway-confirmed payment; such conversions need jurisdiction-specific finance review.
- Server-side register pagination uses bounded page numbers; very high-churn concurrent insertion can shift offsets. A cursor-based strategy is a future scalability improvement.
- A failed web request can have an uncertain outcome. The operator must recover using the existing idempotency key; avoid printing a second sale before confirming the original.
