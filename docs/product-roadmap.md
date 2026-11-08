# Product roadmap

> **Current as of 9 November 2026.** [Release-status decision and issue disposition](release-status.md) supersede the October planning-stage release holds. Implementation and activation are distinct: a code-complete feature does not imply an approved payment provider, statutory invoice, external AI provider, Play publication or complete disaster-recovery drill.

## Delivered product

- Free permanent QR menus, menu import/review foundations, merchant onboarding, versioned publishing, private/approved media, QR Studio, outlet profiles, and responsive public browsing.
- Guest ordering (including free-tier limited intake), authoritative quotes and service status, multi-station Kitchen Pro with routing/expeditor, staff workspaces, Dining Floor and the standard POS with cashier shifts/receipts.
- Paid plans, guest CRM, merchant sales-tax quote/snapshot support (opt-in, non-fiscal), Android TWA foundation and signed internal AAB workflow, plus optional Google Play Billing server integration (disabled by default pending provider/store configuration).
- Incremental security and UI fixes from PRs #306, #313, #321, #328, #330, #331, #332, #335, #338, #339, #342 and #344.

General Phase 4/5 launch holds have been lifted by owner decision; they are **not** proof that every historic acceptance check passed. Runtime authorizations, tenants/roles, subscriptions, configured providers and fail-closed finance boundaries remain in force.

## Current work, not a general web launch hold

1. **Google Play internal distribution:** #340; Play Console, app signing assetlinks, compliance declarations, physical tests and review. Assetlinks returned 503 during the 9 November public check. Native verified deletion remains in #286.
2. **Independent operational quality:** #47 and #76; live device/role/accessibility, capacity, restore/ERP coexistence and threat testing. #49/#131 were already closed in GitHub, but a closed ticket is not a substitute for real restore evidence.
3. **Security and responsible intelligence:** #326 residual hardening, #230 Ember provider budgets, retention and action guards; #312 follow-up diagnostic improvements.
4. **Capability-specific rollout:** #249 physical-device push; #226 legal/jurisdiction-reviewed statutory invoicing. Merchant sales-tax collection itself was implemented in #321 and remains opt-in per outlet.
5. **Commerce and worldwide operations:** monitor actual Razorpay/Google Play configured subscriptions, cross-border checkout eligibility, dispute/reversal paths and localized merchant compliance. USD list pricing is not proof of USD self-service checkout.

## Plans and current positioning

Free: ₹0, 20 dishes and 2 QR codes; Ordering: ₹119/month (USD listing $5); Kitchen Pro: ₹499/month flat for up to ten outlets (USD listing $20); Dedicated: ₹30,000/month or $3,000 private on-premise by contract. Prices and quotas derive from catalogs; purchase buttons must reflect runtime sale authority. **Do not advertise certified GST/VAT invoices, card settlement, all-device push, or a published Play app without separate verification.**

## Source of truth

- [Release status](release-status.md)
- [Live commercial availability contract](commercial-availability.md)
- [Feature activation diagnostics](feature-activation.md)
- [Production runbook](production-runbook.md)
- [Android release program](android-release/README.md)
- [Historical Phase 4](orchestration/phase-4.md) and [historical Phase 5](orchestration/phase-5.md) planning documents

The earlier 25-owner / 50-outlet / 1,000-order-per-hour target is **a planning target**, not a measured production capacity guarantee.
