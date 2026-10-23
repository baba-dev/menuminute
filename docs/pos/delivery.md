# POS 1.0 — delivery sequence and release gates

Status: proposed delivery plan; epic [#142](https://github.com/baba-dev/menuminute/issues/142). The RFC PR is documentation-only and must not be represented as a working POS, production migration, successful tax validation or completed test run.

## Ownership and sequencing

Use the repository development orchestration contract: one named domain implementer per issue, reserved write paths, and one schema/auth/CI writer at a time. Publish producer contracts before work on UI consumers. Keep related runtime changes in small independently reviewable PRs, with independent finance/security review before enabling commercial use.

| Slice                                | Deliverable                                                                                                                                                                                   | Dependency and acceptance                                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| A — Financial identity and contracts | Approved merchant legal profile, country/tax policy, invoice lifecycle, printer and initial checkout UX; deterministic fixture examples                                                       | Product/accountant decisions and implementation RFC accepted; no mock compliance                                                 |
| B — Durable core                     | Additive SQL migration after current journal, Drizzle declarations, scoped sale/order bindings, fiscal issue sequence, tender and document ledger, audit/outbox; no runtime access by default | Migration runs twice in test PostgreSQL; isolation constraints, permissions and rollback compatible with old web/worker          |
| C — POS command producer             | Authenticated sale creation, existing-order attachment, server-authored quotes, discount approval, canonical food order/KDS path, optimistic versions                                         | Concurrent terminals cannot duplicate order, lose line allocations or bypass kitchen; price/availability change returns conflict |
| D — Tender and shifts                | Partial/mixed/manual tender, cash change, external-reference status, durable idempotency/recovery, cashier opening float/cash movements/close reports                                         | No overcollection/double posting, stale-caller conflict, refunded amount bounded, shift reconciliation explainable               |
| E — Invoices and corrections         | Immutable invoice issuance, region-selected tax profiles, serial allocation, detailed tax/item/seller/buyer snapshots, 58/80mm/A4 rendering, safe email/reprint, credit/debit notes           | Concurrent issue/retry allocates exactly one number/document; corrections preserve original; reviewed jurisdiction fixtures      |
| F — Integrated Ink & Ember UI        | Till, Ledger, Closing Desk, POS settings; dashboard navigation and existing order settlement entry; private metadata                                                                          | Touch/keyboard/mobile/light/dark/reduced-motion/empty/error and limited-access states covered in Playwright                      |
| G — Hardening and release            | Payment endpoint migration/cutover, legacy status reconciliation, reconciliation worker/alerts, exports, operational runbook and measured load                                                | Independent finance/security review, PostgreSQL/Redis tests, final exact-SHA ARM64 CI and operator tax review                    |

## Decision gates before slice B

- Merchant seller-of-record relationship: one legal entity per outlet or explicitly mapped shared entity, with separate tax registrations and legal address.
- First supported locale(s) and document types; India GST can be the first adapter, but global release must not assume India rules for all outlets.
- Fiscal series/fiscal year rules and number format (per locale), tax-inclusive/exclusive default, line-level tax classification/rounding examples and whether any mandatory e-invoice reporting adapter is required before activation.
- Card/UPI strategy: initially manual recording of external settlement versus actual gateway collection. Do not infer provider confirmation from manual entry.
- Whether group split bills and return against individual lines belong to V1 or a following gated slice. Design data model for them from day one.
- When POS billing can occur relative to kitchen fulfillment; distinct from invoice issuance and payment completion.

## Acceptance test matrix

### Calculation and fiscal correctness

- INR with GST-inclusive and GST-exclusive per-item components; explicit CGST/SGST/IGST policy when locally applicable and signed off. 0-decimal and 3-decimal ISO currencies.
- Discounts before/after tax by configured regime, mixed tax classes, high quantities, rounding remainders, tips/service charge separation, negative/overflow/non-integer client payload rejection.
- Invalid merchant registration, stale tax profile, fiscal-year boundary, timezone/DST changes, cancellation before issue vs correction after issue.
- Duplicate issue clicks, two concurrent registers, commit succeeded but response lost, printer/email failed after issue; exact same immutable serial/document result.

### Settlement and reconciliation

- Multiple methods and partial payments; cash tendered greater than amount applied with explicit change. Prevent over-allocation and crossing currencies.
- Simultaneous payment commands, stale versions, gateway callback duplication/reordering, external pending/uncertain response, retry after crash. Never display a false success.
- Partial/full refund, authorized corrections, refund greater than captured rejection, disconnected shift close, counted-vs-expected cash and cash-drop audit.
- Historical coarse paid status must not produce synthetic tender rows or silently rewrite financial history.

### Access and integration

- Cross-organization/outlet ID swaps for every read/write/export; revoked cashier session/device; manager approval; kitchen-only staff cannot view customer finance.
- Existing QR menu remains free; existing guest order tracking unchanged; a staff food order creates a canonical ticket and Kitchen Pro receives only authorized work.
- Paid feature revoked mid-sale: define explicit policy, preserve work already accepted and historical document access, deny new work without orphaning amounts.
- PII redaction in logs, no secret/payment credentials in source/outbox or browser, bounded queries, no-store private responses and non-indexable pages.

### Release and operations

- Real PostgreSQL integration with transactional RLS and SQL-only authorization, Redis queue outage/recovery, multiple tabs/registers and Playwright complete merchant flows.
- Run lint, typecheck, unit/integration/E2E, production build and independent security/finance review on latest rebased SHA.
- Verify verified ARM64 build and artifact digest, checksummed migrations and DB compatibility. Before any automatic live activation take and verify off-host backup and check ERP HTTP 200 before/after. Never auto-enable POS through an additive migration alone.
- Deployment uses an explicit POS feature flag and merchant profile readiness gate. Canary one internal/demo outlet with non-fiscal test documents, then approved live merchant(s), then broaden by jurisdiction.
- Operators receive invoice-sequence, unresolved tender, shift-variance, outbox and rendering alerting; restore drill must show ledger and document artifacts reconstruct consistently.

## External rule references for India adapter assessment

- [CBIC — tax invoice, credit and debit note rules](https://cbic-gst.gov.in/gst-invoice-rules.html)
- [GST portal — e-invoicing overview](https://tutorial.gst.gov.in/downloads/news/pamphlet_e_invoice_overview_updated_on_17_08_2023_approved_final.pdf)

Treat these as research starting points, not automatically current eligibility certification. A POS invoice PDF alone is not the IRP-signed e-invoice/IRN required for an eligible taxable business supply. Check current notifications and obtain local professional validation immediately before legal activation.
