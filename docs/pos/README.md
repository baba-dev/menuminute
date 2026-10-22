# MenuMinute POS 1.0 — native end-to-end merchant billing

Status: implementation RFC / work-package baseline, prepared 2026-10-22. **No POS runtime functionality is activated by this document.** Delivery epic: [#142](https://github.com/baba-dev/menuminute/issues/142).

## Product thesis

Build an integrated restaurant POS (the Till), invoice/customer-finance history (the Ledger), and register reconciliation (the Closing Desk), not a second disconnected ordering system. One authoritative outlet/menu/order/Kitchen Pro domain supports staff-entered and diner-submitted food orders. The new POS financial domain owns sales, payment allocations, tax snapshots, invoice issuance, refunds and register closing. SaaS subscription billing remains separately owned by modules/billing and its owner-only billing.manage permission.

This is worldwide software. Outlet country, ISO currency, locale, IANA timezone, registered seller, jurisdictional tax profile and supported payment methods are independent. Payment-provider availability and document legal status are jurisdiction-dependent. Never market a PDF as automatically tax-compliant or as a government-registered e-invoice.

## Verified baseline on main

- Orders and immutable order-item menu snapshots exist in src/db/schema/orders.ts. Existing totals are integer minor units, with guest submission revalidation and a separate fulfillment/payment state.
- src/modules/orders/quote.ts explicitly produces a pre-tax selection. The current guest submission sets tax_minor to zero. It must not be reused as a legally complete fiscal quote.
- The owner-only app_private.record_order_payment function in migration 0006 changes unpaid to paid/voided, logs an audit and emits an outbox event. This is NOT a tender ledger, split payment, gateway transaction or invoice.
- Service Counter, Kitchen Pro, outlet ACLs and the transactional outbox already exist. Integrate through their service contracts rather than direct cross-module writes.
- docs/architecture.md and docs/domain-invariants.md mandate PostgreSQL authority, explicit tenant scope, immutable historical money, versioned commands and duplicate-safe delivery.
- The currently reviewed SQL migration journal ends at 0016. Never edit its historical migrations or imply that main equals the deployed VPS revision.

## Connected merchant journeys

| Entry point | POS flow | Shared behavior |
| --- | --- | --- |
| Walk-in / counter | Start sale, select published menu and variants/add-ons, choose takeaway/dine-in and place order | Creates canonical outlet order, kitchen receives a ticket where food preparation is required |
| Existing QR order | Find and attach an eligible unpaid ticket to a bill | Does not recreate or duplicate an existing order |
| Existing Service Counter order | Open settlement from the order details | Order keeps its independent fulfillment lifecycle and version checks |
| Dine-in table | View eligible open tickets and explicitly attach selected orders to a bill | Further repeat orders are separate tickets; bill assignment is audited |
| Split group bill | Assign selected full/partial line quantities into distinct settlement groups where policy allows | No order item is billed beyond its original quantity; immutable allocation |
| Multiple tender | Cash, card terminal, UPI, bank transfer or authorized custom tender, in one or many captures | Each capture has independent ID, currency, amount, method, source and status |
| Refund/return | Authorized refund against tender and credit/debit note as legally appropriate | Never delete a payment or overwrite an issued invoice |
| Shift closing | Count cash, view expected cash, declare variance, close and export | Shift report is immutable; supervisor corrections are follow-up records |

## Initial delivery scope

The Till: touch/tablet-first product grid with search and favorites, categories, menu photos, variants/add-ons, manual order name, service mode, table, cart, holds, taxes, controlled discounts, tender selection, change calculation and an invoice/receipt action. Keyboard, accessible focus and 48px-class touch targets should support high-pressure counter service. A narrow mobile layout should stack product picker, cart and checkout without hiding the active sale.

The Ledger: immutable invoice list with search by invoice/order/customer/period, full snapshot views, print/download/email, refunds/credit notes, payment allocation history, customer master and filterable per-outlet/date/currency exports. Sensitive customer data is private and permission-scoped.

The Closing Desk: register/terminal configuration, staff shift start/opening float, cash in/out with reason, tender mix, drawer count, over/short explanation, X summary while open, immutable Z close summary and handover. Cash variance is not silently adjusted as a sale.

Settings: seller legal identity, jurisdictional tax registration and effective-dated rules, receipt branding and footer, number series and fiscal year, document-type availability, refund/discount approval limits, payment methods, printer preferences and customer consent. Approval of legal templates and the applicable regime is an explicit merchant/operator gate.

## Boundaries and defaults to validate

- Maintain separate sale, kitchen/fulfillment, tender and fiscal-document lifecycles. A served ticket is not necessarily paid or invoiced; issuing an invoice must follow its jurisdiction's issuance rules rather than a universal paid-only rule.
- POS cannot quietly bypass Kitchen Pro or the existing guest submission idempotency guarantees. Staff orders use authenticated, server-requoted commands and the same canonical order domain.
- Existing paid/voided historical orders are a legacy status, not proof of a captured tender or fiscal invoice. Reconciliation/backfill requires a separate explicit review process.
- Payment references for manually recorded card/UPI/bank tenders do not mean MenuMinute charged or confirmed the provider. Payment gateway adapters must verify signed callbacks, reconcile uncertain outcomes and never store PAN/CVV.
- Invoice/receipt/pro-forma/bill-of-supply/credit-note terminology must be selected by a validated jurisdiction adapter. A digital receipt or print preview is not automatically a legally issued invoice.
- A lapse of new-POS entitlement may prevent new sales but cannot prevent authorized reading, printing, exporting or lawful correction of previously issued financial documents.
- Terminal offline draft may be considered later; no offline invoice-number allocation or confirmed capture until a reviewed conflict/recovery design exists.
- Retain financial records per applicable law and merchant policy, independent of menu media/pruning; enforce sensitive-data minimization.

## Routes (proposed, behind a disabled POS capability)

- /dashboard/pos — the Till, only assigned staff with POS sale access
- /dashboard/pos/ledger — sale/receipt/invoice register
- /dashboard/pos/invoices/[invoiceId] — immutable document and authorized actions
- /dashboard/pos/closing — register shifts and reconciliation
- /dashboard/settings/pos — seller, tax, receipt, tender and terminal policy

All routes must emit private no-store responses and noindex metadata. API commands live under the existing /api/organizations/[organizationId]/outlets/[outletId]/pos boundary and re-verify the authenticated live session, organization/outlet relationships and fine-grained permission on every read/write. Do not place confidential invoice data on the public CDN.

## Commercial isolation

Keep MenuMinute platform subscription invoices, entitlements, payment collection and billing administrators out of merchant POS tables. POS activation is a distinct commercial capability, not inferred from ordering.new or kitchen.new. Free QR publishing remains free; no new-paywall rule retroactively disables an already accepted order or invoice retrieval.

## Design language

Follow the present editorial dashboard and Service Counter: Ink & Ember light/dark styling, prominent legible numerical hierarchy, intentional Ember primary action, explicit success/conflict/uncertain states, reduced-motion support, and dense but readable tender/invoice tables. Avoid fake payment certification badges, unverifiable compliance marks or simulated provider acceptance.

See [financial contracts](contracts.md) and [delivery and release acceptance](delivery.md) before implementation.
