# Merchant-configurable tax calculation — delivery plan

**Status:** implementation proposal, 2026-11-03. The owner requests merchant-entered tax
rates reflected in online orders, POS, customer receipts, refunds and reporting.
This plan is **not** permission to generate certified GST/VAT invoices or silently
declare any jurisdiction's required rate. See [POS financial contracts](../pos/contracts.md)
and [statutory invoicing issue #226](https://github.com/baba-dev/menuminute/issues/226).

## Existing code and missing connection

- The order model already persists `subtotal_minor`, `tax_minor` and
  `total_minor`, but `submitGuestOrder` currently sets `taxMinor = 0`.
- `quotePublishedSelection` explicitly returns `taxAndFeesCalculated: false`.
  It correctly validates released menu prices; retain that guarantee.
- `src/lib/pos/finance-math.ts` contains checked integer arithmetic,
  `genericTax` (basis points and inclusive/exclusive modes) and proportional
  discount allocation. This is a **primitive**, not a complete tax-policy engine.
- Current private POS receipts print the subtotal, and say they are **not**
  fiscal/tax invoices; fiscal issuance is deliberately blocked by the DB gate.
- The restaurant's sale taxes are separate from MenuMinute subscription taxes.
  Adding a merchant tax setting must not modify Razorpay subscription charges.

## Merchant experience

Add **Outlet Settings → Sales tax** (permissions: owner or delegated outlet
financial-settings administrator). Keep **one outlet policy**, never a hidden
global organization tax. Make it possible to:

1. Choose `Not configured`, `No tax charged (confirmed)`, or
   `Merchant-configured tax`. An unconfigured state is not treated as a legal
   zero-rate declaration; published menu browsing remains available.
2. Choose a merchant-authored label (for example, GST, VAT or Sales Tax);
   single-rate percentage entered as a decimal with max two fractional digits
   and bounded range (initially 0.00–100.00%; `5.00%` = 500 basis points);
   and **tax-inclusive** or **tax-exclusive** menu prices.
3. Review a live, currency-aware example before saving, including JPY/INR/OMR
   minor-unit rounding. Explicitly confirm the merchant is responsible for
   the legality of the configured rate, registration and classification.
4. Optionally assign a tax class to each dish (standard, exempt, zero-rated),
   but only after the first one-rate release. Never infer tax class using AI.
5. See the effective date, last editor and policy version, with history and
   a clear warning that existing completed orders and receipts never change.

Sales tax must be configurable in the **same place regardless of the active plan**.
No separate POS-only tax percentage, and no automatic rate selected from a
country/currency. Place/time/seller registration are reviewable identity inputs
when the statutory adapter is later introduced.

## Source of truth / database

Design a versioned `outlet_tax_policies` record (tenant and outlet constrained)
with `organization_id`, `outlet_id`, `version`, `status`, `country`,
`currency`, `label`, `rate_bps`, `price_mode` (inclusive/exclusive),
`effective_at`, `created_by`, `created_at` and `reason`.
Maintain an append-only previous-version audit. Use a scoped transactional
update with expected-version compare-and-swap and tenant/role RLS. Do not
overwrite historic versions. Changes take effect only on **new** quotes/orders.
The public menu does not expose tax registration secrets or private settings.

Every new order should snapshot `tax_policy_version`, `tax_rate_bps`,
`tax_label`, `tax_inclusive`, `taxable_base_minor`, `tax_minor`,
`subtotal_minor`, `total_minor` and line/component breakdowns in integer
minor units. Refunds/voids reference original snapshots; never recompute using
today's rate. An outlet's currency exponent comes from ISO currency metadata.
Additional tax components and jurisdiction adapters must be separately
versioned instead of editing existing snapshots.

## Shared calculation and trust boundary

Build one server-side `quoteFinalOrder(selection, outletPolicy, at)` service,
consumed by **public cart**, **guest submission**, **POS**, **order activity** and
**receipts**. Its inputs must come from the released menu and current scoped
policy in the trusted server transaction, not client-submitted tax or total.
Quote output includes currency, exponent, line prices, tax components, total
and a revision/expiry token. Before final submission, revalidate prices,
availability, policy revision and effective time. If any changes, return a
409 review-required response with the updated quote (never silently charge
more). Retain the existing idempotent order-key recovery.

For the initial one-rate implementation:

- Calculate with integers/BigInt and bounded 64-bit intermediate amounts.
  Use published **half-up** rounding to the smallest currency unit, per order
  line and tax component. Reconcile `sum(line amounts) = header totals`.
  Never perform tax arithmetic with binary floating-point amounts.
- Discount order: allocate approved discounts to lines proportionally
  **before tax** using stable remainder distribution; calculate tax on each
  discounted taxable amount. No fee or tip is silently called tax.
- **Exclusive** price: base = merchant menu price, tax is added to total.
- **Inclusive** price: merchant menu price already contains tax; extract its
  tax portion without adding it again, and display the pre-tax base separately.
- Exempt and zero-rated classes have different business meaning even if both
  calculate zero tax. Retain the classification in the order snapshot.
- Respect partial refunds, mixed tender, receipt reprints and POS-originated
  kitchen orders without ever charging the same canonical order twice.
- Where no approved rate/mode exists, report `taxNotConfigured` or
  `merchantConfirmedNoTax` explicitly. Do not say that a zero total means
  legal compliance.

Illustrative, **non-jurisdictional** examples:

| Currency | Mode | Menu price | Tax rate | Base | Tax | Customer total |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| INR | Exclusive | 200.00 | 5.00% | 200.00 | 10.00 | 210.00 |
| INR | Inclusive | 210.00 | 5.00% | 200.00 | 10.00 | 210.00 |
| JPY | Exclusive | 100 | 8.00% | 100 | 8 | 108 |
| OMR | Exclusive | 1.250 | 5.00% | 1.250 | 0.063 | 1.313 |

These examples prove arithmetic, not that any quoted rate is appropriate for
India, Japan, Oman or another country.

## Where the same snapshot appears

| Surface | Required behavior |
| --- | --- |
| Public menu and cart | Show inclusive/exclusive tax label, estimated tax and **final total before confirm**; refresh quote after item/availability or tax change |
| Guest checkout/confirmation | Capture and replay exact tax-policy version and final total; re-confirm changed prices |
| Merchant Orders / Kitchen Pro | Display tax breakdown read-only; do not recalculate while preparing or completing |
| POS register and till | Use same quotation; show subtotal, tax, total, tender amount, cash change and refunds; preserve original order linkage |
| 58/80mm receipt, A4 receipt, email | Print the snapshotted tax label/rate/base/amount and final total; visibly label as an **ordinary non-fiscal receipt** |
| Refund, void, repeat order | Refund the historic amount and allocate tax reversal; **repeat** makes a fresh quote with the current policy |
| Reports/export | Show net sales, collected tax, refunds, gross sales by **currency** and policy/rate; never sum INR and USD; no false claim that collected tax equals statutory tax owed |
| Audit/history | Who changed settings, prior values, effective time, affected orders, no retrospective rewriting |

## Separately reviewable implementation phases

**A — Contract and UX:** define read/write permissions, schema validation,
settings mockups, preview examples, historical snapshot field names and
failure states. Approve the initial single-rate scope. No runtime enablement.

**B — Versioned persistence:** additive SQL migration, indexes, RLS, policy
audit trail, conditional updates and immutable order snapshot storage.
Existing historical order rows remain untouched.

**C — Calculation engine:** pure shared BigInt quote finalizer, 0/2/3-digit
fixtures, inclusive/exclusive, discounts, overflow and optional class.
Retain and reuse `quotePublishedSelection` as the pre-tax component.

**D — New guest checkout:** end-to-end server quote, policy revision
check, customer confirmation, 409 recovery and idempotency.

**E — POS/till:** reuse same finalizer; preserve shift close, staff attestation,
refund rules and cross-terminal order binding.

**F — Documents and reports:** receipt and email templates, export tax
breakdowns and reversal/analytics projections. Keep fiscal invoice guard
closed; separate regulated adapter is issue #226.

**G — Settings UI:** accessible Ink & Ember editor with preview, validation,
permissions, audit/history and save conflict recovery; end-to-end real
restaurant fixtures.

**H — Rollout and verification:** run real PostgreSQL, two Redis workloads,
ARM64 browsers, multi-terminal races, store old/new orders side by side,
reprint old receipts, and test tax change during a pending guest cart.
Canary behind an explicit, reversible per-outlet activation with independent
review. A source merge alone is not proof of production readiness.

## Acceptance and irreversible boundaries

- Tax policy is always server-owned. A browser cannot forge a lower tax rate,
  approve an incompatible version, see another tenant's policy or change an
  already issued receipt.
- A price or tax update before customer confirmation must be shown to the
  customer; a disputed/uncertain submission never silently duplicates orders.
- Public, POS, merchant order and receipt use the **same order snapshot**.
  Cross-currency, refunds and historical reprints are correct in 0/2/3
  decimal currencies.
- The financial tax policy and statutory tax-invoice adapter are intentionally
  separate. Legal/tax review of particular jurisdictions, registrations,
  registration thresholds, tax-exemption records and statutory invoice
  requirements must be completed before asserting compliance.

**This document is a plan only. No tax configuration, tax charging or fiscal
invoice issuance is activated by the USD price-book PR.**
