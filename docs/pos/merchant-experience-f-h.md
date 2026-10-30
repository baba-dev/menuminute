# POS 3.0 — One coherent review stack for #142

This document is the canonical review map for PR #225. All source changes on this branch derive from the same `main` baseline and remain in **one PR**, not a second redesign. Every functional phase has a separately inspectable commit and test evidence, and historical payment/tax migrations are never rewritten.

## Implemented: A–D (previous phase)

- **A — Contracts**: existing [core finance contract](core-finance-a-d.md). One canonical order, append-only cashier attestations and finance tenders, no automatic fiscal classification.
- **B — Settlement**: private per-sale dual-source settlement, corrections and Ledger parity (migrations 0046 and 0048). No direct finance-table grants.
- **C — Math**: BigInt checked amounts, strict tender/change rules, stable discount allocations and generic rounding test fixtures. No tax profile/discount switch is activated.
- **D — Corrections**: immutable staff-payment full refund with authorization, idempotency, cross-outlet denial, receipt and audit/outbox update (migration 0047). Provider refunds still use the existing gated path.

## Implemented: F–H (merchant experience)

- **F — Reconciliation**: migration 0049 adds `app_private.pos_reconciliation_page` with explicit authorized outlet scoping, maximum 100 records per request, and a strict keyset cursor. Includes sales without frozen bills, staff reversals, tender/refund checks and provider/document uncertainty. Closing Desk exposes progress, anomaly lists, next page, and partial-coverage warning. A completed walk-through means *all pages were visited during the live scan*, NOT point-in-time SQL isolation or bank reconciliation. No full synchronous database scan; the old bounded method stays available for backward compatibility.
- **G — Ledger & Reports**: migration 0050 adds outlet-scoped 50-record Ledger pages; UI can load older history without creating a competing ledger. Migration 0051 combines staff-collected and operator-gated tender/refund amounts in Reports using their **event dates**, not order creation dates. It distinguishes cashier-attested external references from provider-confirmed money, counts staff refund compensation, and exposes cash with no recorded shift as **unassigned**, never silently injecting it into the existing drawer expected cash. Exports are restricted to the rows actually loaded and neutralize spreadsheet-formula prefixes. Complete report export, bank statement matching, and closed-period accounting certification are future work.
- **H — Responsive merchant UI**: at small widths, Ledger uses accessible sale cards rather than forcing a six-column offscreen table. Selected records show the source-specific settlement evidence; Closing Desk scans progressively; Reports explains unassigned cash and time-basis. Screens remain accessible without finance/provider activation.

## Tests and quality gates

- Real PostgreSQL/Redis integration: serial and concurrent staff refunds, protected cross-outlet and direct-table denial, existing provider/mixed-tender and credit regressions, strict money fixtures, bounded pagination with non-overlapping records, data parity between Ledger and Reports before and after staff refund, report read denial.
- Browser: POS cashier order, responsive Ledger cards and financial detail, Closing Desk progressive scan, Reports till snapshot on 390px viewport; the repository's other browser suites remain required.
- Exact **final PR head** must pass all six CI lanes, full ARM64 build, secret/SAST checks. Reviewer must independently scrutinize restricted SQL definer authority, the wording of financial evidence, shift attribution, rollover/rounding, and migration rollback expectations.

## Future phase gates, reserved but not activated by this PR

- **E — Fiscal documents**: explicit jurisdiction-specific tax/invoice adapter, externally reviewed invoice serial and registration rules, immutable issue/refund documents, human compliance approval. Registered invoice remains fail-closed.
- **I — Quality and threat model**: independent financial/security approval plus production-sized load and degraded-provider response. Green CI alone is not security sign-off.
- **J — Release operations**: operator-approved activation, verified production migration and observability, canary/release rollback while preserving immutable data. Existing backup limitations (#131/#49) are not silently converted to restore certification.

## Deliberate limitations

Staff payments made without opening a register are **unassigned cash**, not counted physical drawer cash. No new auto-assignment/backfill is made. Reconciliation validates internal ledgers, not physical cash, acquiring statements, external deposits or country law. Reports' invoice-like Z summary remains explicitly provisional. The POS still prints a non-fiscal operational receipt when a registered invoice adapter is unavailable; the historical staff **Mark as Paid** stays gateway-independent.
