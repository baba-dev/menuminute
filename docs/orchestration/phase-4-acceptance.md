# Phase 4 Free QR Menu — executable acceptance matrix

Parent [#37](https://github.com/baba-dev/menuminute/issues/37); QA package [#47](https://github.com/baba-dev/menuminute/issues/47). Status: test plan and existing test coverage enumerated; this document does not assert unrun production acceptance. For each final feature PR record its exact head SHA, links to all four native ARM64 checks plus aggregate gate, desktop/mobile screenshots, untested failure paths, and independent review. Release acceptance requires one integrated final-main run, not stitched green results from intermediate commits.

## Browser journey

- [ ] New owner registers and creates the first organization/outlet with actual authorized membership. Verify restaurant/cafe/takeout/cloud kitchen/hotel/mixed presets in Light/Dark/System and across 360/390/768/1024/1440 px.
- [ ] Same POST identity retries after a lost response without a second outlet, and changed payload gets a fresh key. Entered fields and service modes remain after errors and refresh/recovery.
- [ ] Merchant adds category/dishes, variants, required and optional flat add-on options, sold-out, local schedule, independent supported ISO currency. Invalid precision and malformed required groups fail clearly; no nested combo rule invented.
- [ ] Draft save is private. Second concurrent editor's stale write cannot replace the published release. Publish after authoritative commit; cancel/failed publish retains the prior release and entered data.
- [ ] Scoped media upload stays private, worker processes it with correct shared permissions; explicit approval before public derivative appears. Failure keeps existing published photo. Revoke/unapprove immediately blocks new public reads. No inference key necessary.
- [ ] Guest sees only released categories/dishes, tested search/filter, sold-out overlay, unavailable required options, overnight/outside service, no checkout/ordering CTA. Offline state labels stale data; revoked QR on refresh removes old guest dish content.
- [ ] Permanent canonical/table QR PNG/SVG downloads and selected-code printing work with fallback URL. Edit/rename/type/plan change preserves token; owner-only revoke/regenerate invalidates just the intended old token. A copied QR is not physical-presence proof.
- [ ] Dashboard correctly distinguishes draft, released, revoked and absent states across two outlets and two organizations; no stale legacy counts, no cross-tenant data or unauthorized actions.
- [ ] Marketing/pricing does not show unapproved INR 149/299 prices or imply ordering/KDS is currently purchasable.

## Technical and accessibility evidence

- [ ] Test isolated PostgreSQL migration from empty DB, real two-Redis integration, worker, tenant/role isolation, draft/publish races, and QR recovery; synthetic/demo data only in nonproduction.
- [ ] Production standalone ARM64 Playwright: login, onboarding, Menu Studio, guest, QR, public homepage/pricing, desktop/mobile, Light/Dark/System, persistence, keyboard/focus, meaningful accessible status, reduced motion and 44px touch areas.
- [ ] Four exact-final-SHA lanes: Lint & Code Style, TypeScript Strict Typecheck, PostgreSQL & Redis Integration, Production Build & Browser, then Required CI quality gate.
- [ ] Independent diff review; record migrations/rollback; no failed/skip CI accepted as pass.

## Separate operator-backed release gates (not established by CI)

- [ ] Confirm both web and worker exact SHA and installed root-owned helper v3; no automatic migration; public readiness release matches source SHA; ERP HTTP 200 before/after.
- [ ] Controlled authenticated test-outlet upload/process/approve/publish/public QR scan/revoke without real orders or paid providers.
- [ ] Nightly backup timer actually enabled and successful, encrypted off-host restic repository and off-host failure escalation verified.
- [ ] Disposable restore of SQL **and** matching private media, including consistent snapshot/write barrier or documented reconciliation; no restore over live data.
- [ ] Resource/disk/WAL/media headroom and combined MenuMinute/ERP load evidence recorded with thresholds and escalation owner.
- [ ] User-facing "Phase 4 production complete" only after all boxes are supported by actual artifacts, not an issue/PR description.

Existing partial coverage: `tests/e2e/foundation.spec.ts`, `menu-product.spec.ts`, `styling.spec.ts`, `core-domains.spec.ts` and Phase 4 PR-linked specific regression tests. This document alone closes no test gap or operational acceptance.
