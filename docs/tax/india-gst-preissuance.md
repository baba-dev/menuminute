# India GST statutory invoicing — pre-issuance review (issue #226)

**Status: DRAFT REVIEW ONLY. No licensed statutory issuer, IRP integration, fiscal-number allocator or statutory credit-note issuer is enabled.**

This module is an additive, country-specific foundation. It is **not** approval of India GST tax collection or filing, nor does it change the jurisdiction policy, existing immutable POS documents, staff-recorded payments, or international Free menus.

## Regulatory context to verify before activation

- CGST Act, section 31: registered suppliers' tax invoices, bills of supply for exempt/composition supplies; section 32 prohibits unauthorized GST collection; section 34 covers credit and debit notes.
- CGST Rules, Rule 46: supplier/buyer identities, GSTIN, fiscal-year-unique serial (not exceeding 16 characters), issue date, HSN/SAC, taxable value, place of supply, component rates and amounts, reverse charge and signature.
- Rule 49 covers bills of supply; Rule 53 and section 34 govern credit/debit linkage.
- Notification 10/2023–Central Tax and GSTN IRP notices describe e-invoice applicability, including a ₹5-crore annual turnover threshold for relevant eligible taxpayers from August 2023. **The app does not infer IRP liability from a user's input**, and current requirements, exemptions, turnover across PAN, transaction class and reporting deadlines must be verified for the actual taxpayer.
- IRP advisory effective April 1, 2025 imposes a 30-day e-invoice reporting restriction for certain taxpayers with AATO ₹10 crore or more. This is not a universal timestamp rule.

Authority references:

- https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001
- https://taxinformation.cbic.gov.in/content-page/explore-act/1000300/1000001/invoice/ACTS
- https://taxinformation.cbic.gov.in/content-page/explore-act/1000304/1000001
- https://taxinformation.cbic.gov.in/content-page/explore-rules/1000144/1000001
- https://www.gstcouncil.gov.in/node/4365
- https://einvoice6.gst.gov.in/content/revised-time-limit-for-e-invoice-reporting-for-businesses-with-aato-of-%E2%82%B910-crores-above/

## Implemented in this PR

1. Merchant can open **The Ledger → a frozen sale → Registered invoice readiness → Prepare India GST draft review**. This is only available through authenticated, authorized POS document access.
2. Server re-reads the same scoped frozen POS sale and seller identity through `app_private.pos_fiscal_readiness`. API client **cannot submit** amounts, currency, seller identity, fiscal serial, IRN or government approval flags. It may only declare the buyer, state, HSN/SAC, unit, rate, component split and IRP-review status. Buyer details are transient: the endpoint neither stores nor emails them.
3. Pure integer-minor-unit preview computes per-line CGST/SGST, CGST/UTGST, IGST and cess with half-up rounding, and separately checks the frozen historical values. It refuses to reconcile changed classifications/rates to old paid amounts without a mismatch warning.
4. A written list of blockers is always returned. The `statutoryIssuanceAllowed`, `irpVerified` and `serialAllocated` fields are literal `false`. No QR/IRN, serial, signature, official invoice, bill of supply, PDF, customer delivery or credit note is produced.
5. Existing `pos_jurisdiction_guard` and finance command issuance policy remain untouched and fail closed. Old receipt/POS/QR service paths remain unchanged.

## Implementation still required before lawful issuance (do not weaken gates)

- Obtain signed product-owner jurisdiction decision and independent India GST specialist/legal verification, effective-dated rates and correct restaurant supply classifications/HSN/SAC. The generic merchant tax percentage in #314 is **not** a legal GST classification.
- Verify supplier GSTIN status, composition/exemption eligibility, place-of-supply treatment, reverse charge, buyer type, Indian state/UT regime, cess and invoice/bill-of-supply distinction.
- Design trusted, versioned merchant and per-dish classification records; integrate #315's canonical tax arithmetic into guest orders, POS, bill freeze, discounts, refunds and reports (including 0/2/3 currency controls). Currently this adapter accepts only a frozen **INR** classified POS bill.
- Design separate, database-serialized **India financial-year** serial allocation and return linkage (no reuse across outlets/series), statutory credit/debit notes and immutable signed fiscal snapshots. General POS document sequences are **not** proof of compliance.
- Implement IRP gateway using verified eligibility, signed response verification, idempotency on uncertain results, retries, reconciliation, signed QR and IRN records. Do not produce fake IRN or QR.
- Actual compliant A4/58mm/80mm print templates with signatures and jurisdictional particulars, delivery, void/reversal rules, tax reports, GSTR exports and regulator-specific deadlines.
- Conduct live database migrations on staging, concurrent issuance/rate-change tests, real payment/fiscal reconciliation, printer acceptance, backup/restore, independent finance/security/legal review, then a separate **operator-approved** commercial release.

## Rollout

Merge of this PR only publishes a **review-only** UI. The existing operational POS and receipts remain available where otherwise entitled; all statutory issuance remains blocked. Do not close #226 after merging the preparatory PR.
