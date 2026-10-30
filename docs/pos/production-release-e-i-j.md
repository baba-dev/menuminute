# POS #142 — Phases E / I / J: compliance, security and guarded release

**Status: source implementation and CI review, NOT a live financial activation, statutory certification, or deployment authorization.**

This document supplements [A–D](core-finance-a-d.md) and [F–H](merchant-experience-f-h.md) in the **same PR #225**. Existing payment lifecycle and always-available cashier **Mark as Paid** behavior remain unchanged. Migrations 0000–0051 are immutable; the new 0052 migration adds a protected fiscal **read-only** diagnostic.

## E — Jurisdiction-specific documentary architecture

Registered statutory invoice issuance remains **blocked** in \`app_private.pos_jurisdiction_guard\` for every outlet, including those where \`fiscal_approved=true\` or \`jurisdiction_policy='registered_external_adapter_required_v1'\`. The new \`app_private.pos_fiscal_readiness(outlet,sale)\` reads only an outlet-authorized frozen bill, seller and buyer snapshots and finance gate status. It never inserts into \`pos_documents\`, allocates an invoice serial, contacts IRP, or updates \`pos_finance_gates\`. The accompanying pure TypeScript jurisdiction assessor and Ledger panel show reasons that an invoice **cannot yet be issued**.

India diagnostic references:

- [CBIC CGST Rules Rule 46](https://taxinformation.cbic.gov.in/content-page/explore-rules/1000136/1000001) covers supplier identity/GSTIN, fiscal-year serial, issue date, recipient fields, HSN/SAC, quantity, description, place-of-supply and applicable tax components. The diagnostic rejects a generic menu tax classification as sufficient for a statutory invoice.
- [GSTN e-invoicing overview](https://www.gstn.org.in/e-invoicing) describes separate IRP reporting and signed IRN/QR evidence for covered taxpayers and supplies. The business's applicable eligibility must be established by a qualified professional; a PDF receipt or internal invoice serial does not substitute for IRP evidence.

**Dedicated follow-up approval needed before any registered invoice issuance:** qualified local tax/legal review of HSN/SAC and rates, intra/inter-state supply, B2C vs B2B document fields, receipt vs bill of supply, invoice/credit numbering and limits, taxpayer turnover/IRP applicability, signature, returns/retention and credit/debit adjustments; approved adapter implementing these rules, IRP adapter when required, immutable atomic issue and independent duplicate tests. An internal readiness checklist does **not** satisfy these requirements. Non-Indian markets get an explicitly unsupported diagnostic until their own approved adapter ships.

## I — Security and performance evidence

**Automated tests:** real PostgreSQL migrations, existing finance provider/refund/attestation and split-tender regressions, newly guarded fiscal read (including stale/foreign outlet), direct table access denial, statutory invoice trigger after operator flags, exact-money fixtures; Browser/Playwright at 390px and full ARM64 browser lane; Python release-preflight unit tests for wrong SHA, low root disk, unhealthy ERP, missing invoice trigger and unexpectedly enabled finance flags; repository secret/dependency/code scans. Use GitHub Actions on the **exact final head** only; superseded CI results do not count.

**Independent reviewer checklist (must be completed by humans before changing the PR to ready):**

1. Validate \`SECURITY DEFINER\` owner, \`search_path\`, \`app.outlet_id\`, \`pos_access\`, RLS and denied direct \`menuminute_app/worker\` table reads. Test a revoked manager and cross-tenant document ID.
2. Review \`pos_jurisdiction_guard\` as an irreversible stopper, regardless of merchant input or operator finance flags; inspect the invoice trigger and operator role permissions after migration.
3. Reproduce idempotent full/partial refund races, external refund attestations, conflicting request key replay, provider event replay, chargebacks/uncertain states and cross-period refunds. Merchant-to-bank settlement is **not** claimed.
4. Verify reported period totals against staff attestations, finance tenders, compensation and immutable source records; do **not** invent a shift for unattributed cash.
5. Review invoice serial/legal fields and external tax/IRP applicability with appropriately qualified professionals. **Do not authorize production registered invoicing based on passing tests.**
6. Run bounded concurrency and memory/IO benchmarks with a disposable **CI** PG17/Redis fixture; record read/response p95, large Ledger cursor traversal, background reconciliation page size, ERP status and rollback behavior. The existing \`infra/ops/erp-coexistence.py\` provides read-only shared-host measurements, but no production loads should be generated as part of this source PR. No SLA can be inferred from unit/integration tests.
7. Verify accessible 390/768/1024/1440 layouts, keyboard focus, reduced-motion behavior, print and confidential buyer details; enforce no-store API responses and CSV formula injection controls.

**No spare restore VM:** previous owner decision on #131/#49 deferred independent production restore; keep this risk explicit. PostgreSQL/Redis CI is **not** disaster-recovery certification.

## J — Zero-write operator release gate and staged activation protocol

[Source-only checker](../../infra/ops/pos-finance-release-check.py): Linux/Python3 standard library. Checks the **exact expected 40-character release SHA** against the deployed symlink, loopback ERP (3000) and MenuMinute readiness (3100), both systemd services, free root filesystem (>=10 GiB), root-only local PostgreSQL finance-gate aggregate and the **enabled** invoice insert trigger. It prints only aggregate counts and status, with no SQL writes, no merchant PII, no secrets, no finance activation. Run **only after a reviewed merge and release**, on an operator-controlled VPS checkout with the pinned source; this is not invoked by CI deploy.

A dry preflight would be:

```bash
# Source fetched/reviewed at an exact merged commit on the operator's machine.
# The path may be the vetted source checkout, NOT an unreviewed network script.
sudo python3 infra/ops/pos-finance-release-check.py \
  --expected-sha "$REVIEWED_DEPLOYED_SHA" --require-gates-closed
```

If a merchant has already authorized existing POS finance gates, omit \`--require-gates-closed\` and review the reported outlet-aggregated gate counts with the operator; **do not reset existing gates automatically**. An unverified health endpoint, unexpected gate, or absent trigger is a stop condition. An all-green preflight is **necessary but not sufficient** for activation.

**Manual canary sequence — never performed by this PR:**

1. Code-review exact SHA, obtain independent finance and security approval and applicable legal review. Verify release migrations with the immutable migration journal, backup retention/restore limitations, and financial command idempotency.
2. In disposable CI, test the production build, PG17/Redis migrations, full browser workflows and financial-movement fixtures.
3. Deploy normal source via existing protected release workflow only after explicit authorization; observe ERP before/after the release, disk usage, SQL locks and rollback plan. The scripts here do not restart units or alter the production DB.
4. Operator preflight; if it fails, stop and diagnose. Confirm no registered invoice issuance has been enabled by the new code.
5. For a **separately authorized internal non-fiscal pilot**, test one staff-paid order, one partial/mixed tender, one same-key replay, one refund/credit and one cash-drawer variance. Verify Ledger, Reports and CSV agree and that staff cash is not silently attributed to shifts.
6. Confirm external provider and fiscal integration remain off unless **separately approved**. Observe audit/outbox, gateway uncertainty, snapshot continuity, payment/read-only reporting, ERP health, CPU/disk/memory, reconciliation anomalies, document reprint access.
7. On unexpected behavior: stop *new gated financial actions* via authorized operator mechanism while keeping historical documents/receipts readable. Never delete posted financial records, roll back immutable migrations destructively, or issue a duplicate invoice sequence. Preserve full incident evidence in the audit trail.

**Approval records required:** exact merge/release SHA, CI URL, two reviewer sign-offs, issue owner acceptance, legal/tax evidence by jurisdiction (if applicable), canary results, load p95/ERP co-location observations, deferred restore risk, independent alert delivery status and explicit feature-gate decisions.

**Prohibitions:** No automatic provider activation, no tax-invoice inserts, no IRP credentials in this PR, no mass backfill, no production SQL writes by the checker, no destructive down-migrations, no claim of fiscal or disaster-recovery certification.
