# India GST statutory ledger 3.2 — implementation and release protocol

**Source status:** statutory *data model and verification seams only*. PR #320 does not issue a tax invoice. Existing fiscal issuance is not activated. Issue #226 remains open; issue #315 (actual tax application to guest/POS payments) is a dependency.

## What the release adds

The additive migration `0106_india_gst_statutory_ledger.sql` introduces protected tables under `app_private`, not the app's public tables:

| Object | Purpose | Initial state |
| --- | --- | --- |
| `india_gst_operator_releases` | Per-outlet, GSTIN-specific legal/finance/IRP/signing/printer acceptance record | No rows / all flags false |
| `india_gst_serial_counters` | GSTIN-wide, India financial-year serials with a six-character series and six-digit sequence | No rows |
| `india_gst_statutory_records` | Immutable final statutory document metadata, original and credit/debit references and reconciliation | Empty; app cannot insert |
| `india_gst_irp_audit` | Append-only provider attempt/uncertainty/verified-ack evidence digest | Empty |

No ordinary web/worker/billing role has direct SELECT, INSERT, UPDATE or DELETE to these tables. The serial allocator itself has **no application EXECUTE grant**. The only exposed function, `india_gst_ledger_readiness`, validates the actor's current outlet and document permission and returns a **read-only** checklist with `statutoryIssuanceAvailable: false`.

The serial number is `PREFIX/YY/000001` (max 16 characters), incremented in one PostgreSQL transaction for each `(GSTIN, India FY, prefix)` across outlets, with a unique index to prevent duplicate issuer sequences. The fiscal-year change is April 1. Separate named series must be assigned for tax invoices, bills of supply and credit/debit notes; the system currently does not offer a merchant control for doing this.

The immutable record schema requires the correct source document for a credit/debit note. The insertion guard locks the original document and rejects cumulative credit amounts exceeding it. Frozen POS bill totals, GST seller identity, INR currency and policy revision are checked on original document creation. **These SQL constraints are preparation for a future licensed issuer, not a permission to issue.**

## IRP boundary

`src/modules/pos/india-gst-issuer.ts` contains:

- Offline-only `submit`, `reconcile` and `cancel` operations that throw an explicit *not configured* error without network calls.
- A pinned-public-key RS256 JWS verification primitive for a **future approved IRP partner adapter**, matching GSTIN, financial year, document number and exact minor-unit total. The signer key must be supplied by a trusted operator keyring; never from an invoice field or remote response. All ambiguous/unknown-key/bad-signature/changed-amount cases fail.
- Fiscal-year and series-format functions with regression tests.

This cryptographic primitive is *not* a working NIC/IRIS IRP adapter. Actual provider payloads require verified normalization, tenant authorization, credentials, endpoint pinning and sandbox acceptance. **Do not construct or invent an IRN or a signed QR.** An uncertain provider response requires a read-only partner lookup and reconciliation; it must not trigger duplicate registration.

## Print and review

The existing POS statutory-review workspace shows the release checklist and can print a **DRAFT REVIEW WORKSHEET ONLY** in A4, 80 mm and 58 mm width layouts. Every printed format visibly states “NOT A TAX INVOICE”, “NO LEGAL SERIAL”, “NO IRN” and “NO SIGNED QR”. Printer choice and physical margin/cutover still need real hardware acceptance. These layouts are **not** final statutory tax-invoice templates.

## Remaining production work: no activation until all items are approved

1. **#315 financial parity:** canonical line tax classifications and quote revision, GST rate/cess and place-of-supply, discounts, B2B/B2C rules, bill freeze, original-rate refunds, receipts, reports. Generic sales-tax preferences do not constitute Indian GST tax compliance.
2. **Authority evidence:** registered GSTIN status/issuer scope, Indian supply taxonomy and effective tax rates, Rule 46 invoice fields, Rule 49 bill-of-supply eligibility, Rule 53 credit/debit correctness, authorized digital signature, actual business printing requirements, legal counsel and qualified GST specialist.
3. **IRP certification:** partner enrollment and verified keys, official IRP schema and signed QR/IRN, application for eligible document types, proper cancellation/duplicate/uncertain-submit handling, eligibility/restrictions by taxpayer and document, rate-limit and time-window controls.
4. **Issue function:** transactional allocation + authorized document insertion + immutable signed evidence + audit/outbox, with open/close period and exact GSTIN-scoped outlet permissions. No app issuer command exists in this release. A separate security-reviewed activation PR must implement the actual flow, verify provider evidence and expose the execution path.
5. **Acceptance:** live PostgreSQL/Redis concurrency and simulated provider failures, cross-tenant denial, signed IRP verification, printer acceptance on A4/58/80mm, backups/restores, ERP availability, finance/security/legal signatures, operator runbook, production SHA, deployment/migration and rollback.

### Migration and rollback

Apply registered append-only migration **0106** before deploying the web build. Do not rollback by dropping fiscal tables if records were ever issued. Existing POS, staff-paid flows, Free plan and international checkout remain unchanged. If legal requirements or an IRP provider change, retain financial records and install an audited forward-only migration.

### Primary legal/technical references

- CBIC CGST Rule 46, invoice fields/serial length: https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001
- CBIC Rule 53, credit/debit-note linking: https://taxinformation.cbic.gov.in/content-page/explore-rules/1000144/1000001
- GSTN e-invoicing scopes and signed IRN/QR: https://www.gstn.org.in/e-invoicing
- IRP integration onboarding: https://einvoice6.gst.gov.in/content/api-integration/
- IRP reporting limitation for certain AATO thresholds: https://einvoice6.gst.gov.in/content/revised-time-limit-for-e-invoice-reporting-for-businesses-with-aato-of-%E2%82%B910-crores-above/

These are starting references, not a substitute for effective-dated local tax review and IRP partner certification.
