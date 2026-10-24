# POS D–G: release and operator sign-off

**Status:** the original D–G engine shipped in PR #147; production work package F–H extends it in
migration 0022. This remains a gated finance engine, not a certified worldwide fiscal product. Read
[the current F–H release contract](../production-f-h.md) before activation. Do not rename, rewrite
or reapply historical migrations.

## Implemented and deliberate limits

- **D:** Frozen bill first, then multiple positive staff-recorded cash/card-terminal/UPI/bank tenders; outlet-currency-only allocations, bounded by outstanding balance, explicit cash tendered/change, per-register opening float/cash in/out/immutable Z close and variance. All money movements are append-only and scoped to outlet. Manual external references are not charges, captures, provider verification or bank settlement.
- **E:** Seller profile, explicit nonregistered or dish-classified tax profile. Deterministic integer-minor-unit per-line half-up arithmetic, inclusive/exclusive pricing, immutable seller/buyer/line/tax snapshots, transactional per-outlet/year/type serial allocation, private browser-printable A4 and 80mm output (browser Print > Save PDF), and full-sale refund with one linked credit document. Partial returns/credits are **not** shipped. No downloadable server-generated PDF or email delivery is claimed. Classified rate is a **single configurable generic component**: no implied Indian CGST/SGST/IGST decomposition, jurisdiction determination, HSN/SAC review, official fiscal approval, IRN or signed government QR. This is not an IRP e-invoice integration.
- **F:** The Till links into The Ledger and The Closing Desk. Ledger supports explicit tax setup, preview, bill freeze, staff-attested split tender, private detail and reprint, original document issue where permitted and full reversal. Closing Desk supports register float, movements, historical X/Z data and discrepancy scan. Ink & Ember responsive light/dark styles, noindex and private API no-store, reduced-motion.
- **G:** Restricted functions and no direct app/worker finance-table rights, scoped composite relations, immutable posted-record triggers, operator-only finance gates OFF by default, command key/hash replay, actor/role revocation recheck, outbox/audit, bounded reads, exact-sha CI/real PostgreSQL integration and browser QA. Migration 0022 adds guarded Stripe Checkout/refunds, partial line credits and private document delivery. The latest 500 bills include provider/credit/delivery anomaly classes; older history still requires a separate paged operator audit. This is not bank-statement reconciliation.

## Production operator release gate — DO NOT bypass

1. Merge only the reviewed SHA after the current-main migration compatibility check and all mandatory CI jobs (lint, formatting, strict typecheck, PostgreSQL/Redis tests, ARM64 production build and Playwright) are green. Independent security, product, finance and jurisdiction reviewers must approve.
2. Take and verify encrypted off-host backup, inspect migration checksums and the recovery/rollback posture. Confirm ERP endpoint returns HTTP 200 before and after MenuMinute activation. Do not alter ERP Node, PM2, Nginx or shared ports. Match web/worker release SHAs.
3. **Merchant review:** verify seller legal entity/address/registration, buyer requirements, current country/state tax classifications and legally applicable document requirements with a qualified tax advisor. Generic classified mode must remain disabled for any jurisdiction requiring a richer fiscal adapter (including India GST/e-invoice where applicable).
4. Finance gates in `pos_finance_gates` can only be changed by the migration/operator owner role, never by `menuminute_app` or a public/dashboard API. No row is created by default. Only create or enable a row after written approval and a documented rollback/canary decision; require separate sign-off before `documents_enabled` or `fiscal_approved` is ever enabled. Merchant `pos_outlet_settings.enabled` alone cannot enable collections.
5. Canary on isolated INTERNAL non-fiscal test outlet first: one normal and one split tender, duplicate click/lost response, pre-tax profile mismatch rejection, refund/credit, drawer reconciliation and print. Any failed or uncertain outcome must retain its original key and show an explicit pending/unconfirmed status, never false success.
6. Monitor `pos.finance.*` audit/outbox backlog, failed release, open/closed shift discrepancies, orphan/unissued frozen bills, reconciliation anomalies and invoice sequence audit. Escalate unconfirmed external-method staff entries to the merchant's provider statement reconciliation. Implement gateway adapter before claiming in-app collection/refund.
7. Keep previously issued documents readable/printable/exportable even if POS creation is disabled. Never delete posted financial rows, reuse serials or backfill old `orders.payment_status` as captured tenders.
8. To stop new financial actions, disable the operator gate while keeping scoped historical reads functional; do NOT roll back SQL by destructive down migration or delete financial data.

## Required next specialized work before broad commercial rollout

- Jurisdiction adapter for invoice types and exact statutory line-tax components, per-supply/place-of-supply classification, fiscal-year numbering and statutory fields; IRP integration where legally required. Obtain professional sign-off against CURRENT regulations.
- Independent payment-provider and webhook security review, production canary evidence and bank-statement reconciliation remain required before broad rollout.
- Jurisdiction-specific validation of partial tax reversal and any statutory retention/artifact requirements remains required.
- Bank reconciliation, finance audit retention policy and independent vulnerability and load tests for real concurrent terminals.

## Test map

`tests/pos-contracts.test.ts`, `tests/pos.integration.test.ts`, `tests/pos-finance.integration.test.ts`, `tests/e2e/pos-till.spec.ts`. Run the standard repository exact-SHA CI and independently review SQL `SECURITY DEFINER` rights and required tax policy fixture examples. An accepted PR is not an activated merchant POS.
