# Phase 4 — Perfect Free QR Menu execution baseline

Status: In progress, engineering work packages [#38–#50](https://github.com/baba-dev/menuminute/issues/37). Baseline `main`: `94fb552a06c0aa77729217733eb103771961306f` as inspected 2026-10-17. This file describes source-observed implementation, not independently verified live host state.

## Scope and source of truth

The Free QR Menu product is the launch/acquisition product. Existing PostgreSQL/RLS foundation (#15), organizations/outbox (#19), versioned menus/media/QR (#20), food artwork (#4), and deployment (#35/#36) are merged. Existing Phase 3 behavior, permissions, permanent printed QR continuity, release immutability, approved media and local private originals are retained. Ordering, Kitchen Pro, diner payments, paid AI and commercial plan collection are excluded from Phase 4. Unapproved INR 149/299 pricing is a hypothesis, not a live offer.

Current production evidence: [CI 39036913738](https://github.com/baba-dev/menuminute/actions/runs/39036913738) passed on the baseline SHA; [automatic deployment 39037116483](https://github.com/baba-dev/menuminute/actions/runs/39037116483) reported exact-SHA activation/public readiness and ERP checks. That proves the checks exercised by the workflow, **not** real merchant end-to-end signup/media/QR acceptance, SQL+media restoration, external alerts, capacity, or a new Phase 4 release.

### Source-observed route and component inventory

| Surface                       | Existing entry point                                     | Phase 4 change                                                                                                                         |
| ----------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Registration/login/onboarding | `src/app/register`, `login`, `onboarding/setup-form.tsx` | A02: guidance and safe retry                                                                                                           |
| Dashboard                     | `src/app/(dashboard)/dashboard/page.tsx`                 | A03: replace obsolete `getFullMenu`/category counters with canonical versioned menu state; only label a QR/menu live when truly active |
| Outlet context/sidebar        | `src/app/(dashboard)/layout.tsx`, `context-switcher.tsx` | A03: unified Ink & Ember                                                                                                               |
| Menu Studio                   | `src/components/menu-product/menu-studio.tsx`            | A04a/b: improve existing editor; no parallel second editor                                                                             |
| Public menu                   | `src/components/menu-product/public-menu.tsx`            | A05: presentation, mobile/a11y, existing no-order public semantics                                                                     |
| QR manager                    | `src/components/menu-product/qr-manager.tsx`             | A06: printing/presentation, unchanged QR identity                                                                                      |
| Reviewed media                | Existing `src/modules/media`, Menu Studio media tab      | A07: workflow UX; no automatic paid provider                                                                                           |
| Marketing/pricing             | `src/app/page.tsx`, `src/app/pricing/page.tsx`           | A09: remove unfinalized prices/misleading claims                                                                                       |
| Shared UI                     | `src/styles/globals.css`, `menu-product.css`             | A01: canonical Ink & Ember tokens/primitives                                                                                           |

The older `src/app/(dashboard)/dashboard/menu/menu-manager.tsx` and related `src/modules/menus` are legacy compatibility surfaces. Never delete old tables/service/data based solely on UI cleanup. Public menu already uses a 30-second no-store refresh, an offline/stale label, and suppresses unentitled ordering; keep these. Media privately stores originals, outputs reviewed derivatives, and permits only approved published references; private ETag revalidation still checks that authority on every photo request. Local media is `/var/lib/menuminute/media`; R2 holds encrypted off-host restic backups, not live media.

## Dependencies, issues and proposed exclusive writes

| Wave       | Work                     | Issue | Exclusive area; coordinate before shared changes                            |
| ---------- | ------------------------ | ----- | --------------------------------------------------------------------------- |
| 0          | A00 baseline             | #38   | This document, issue bookkeeping                                            |
| 1          | A01 design foundation    | #39   | global/product CSS and **new** shared UI primitives                         |
| 2          | A02 guided onboarding    | #40   | onboarding files                                                            |
| 2          | A03 canonical dashboard  | #41   | dashboard page/layout and context switcher                                  |
| 2          | A04a publish-safe editor | #42   | Menu Studio component (sole writer)                                         |
| 3          | A04b dish editor         | #43   | same Menu Studio, **only after A04a handoff**                               |
| 2          | A05 guest menu           | #44   | PublicMenu component and dedicated style/test paths                         |
| 2          | A06 QR printing          | #45   | QR Manager component, QR page and dedicated print styles                    |
| 3          | A07 media UI             | #46   | media-only components/tests; Menu Studio after sole-writer handoff from A04 |
| continuous | A08 QA                   | #47   | separate phase-4 tests and acceptance evidence; coordinate shared fixtures  |
| 2          | A09 honest marketing     | #48   | homepage/pricing pages                                                      |
| final      | A10 operations           | #49   | operational evidence/runbook only, separate operator-backed host actions    |
| final      | A11 rollout/handoff      | #50   | docs/release evidence after all gates                                       |

A01 follows A00; A02/A03/A04a/A05/A06/A09 follow A01. A04b and A07 follow A04a and require sequential Menu Studio reservations. A08 scenario preparation can start early but full pass needs integrated features. A10 needs functional acceptance, A11 needs A08 and A10.

Before changing source, each agent records exact base/head SHA, branch/worktree, implementer session, independent reviewer, contract version, write paths, expiry <=24 hours, dependencies and acceptance evidence in the issue. Integration owner is sole reservation writer. Existing open PR #16 owns its dish dataset, #17 owns its Sharp dependency update; do not merge unreviewed changes from either or overwrite their scopes.

## Phase 4 functional acceptance

- New and returning owner onboarding; outlet type, IANA timezone, independent local transaction currency and fulfillment defaults; failed request/retry/reload preserve input and avoid duplicate provisioning.
- Scoped organization/outlet context; only active released canonical menu and active QR state shown as such; draft-only/empty state truthful; wrong-outlet/tenant/role revocation denied.
- Editor: category/dish, flat variants/add-ons, sold out/schedules, money precision, photo processing/approval, draft save and explicit publish; concurrent stale revision and failed publish preserve previous public release.
- Public menu: anonymous mobile/tablet/desktop, search/diet filters, sold-out/no-service, theme and no ordering without entitled implementation; offline label and menu no-store behavior remain, while photo revalidation preserves immediate approval/publication revocation.
- QR: existing print token remains stable on menu/restaurant/type/plan changes; PNG/SVG/print and explicit revoke/regenerate work without changing unrelated codes.
- Full Light/Dark/System, WCAG AA, visible keyboard focus, reduced-motion, minimum touch targets and mobile safe areas.
- Tests: four exact-head Linux ARM64 CI jobs (format/lint, strict TS, real PostgreSQL/Redis, production build/Playwright), one pinned x64 security job and aggregate quality gate; distinct evidence for browser accessibility and operational restore.

## Release and operational gates

GitHub PR checks do not establish host readiness. No automatic SQL: reviewed migration-changing candidate requires independent backup/operator marker and manual path. Only same-migration latest main may autoactivate via installed root-owned v3 helper, exact artifact, pinned host and GitHub environment rules. Public response must match deployed SHA. Preserve ERP port 3000, PM2, global Node 20 and Nginx vhost/certificate. Do not build on shared Oracle ARM64 host. A10 requires a controlled merchant/media/QR smoke and independent proof of nightly backup, SQL+media restore, off-box alert and measured ERP resource coexistence before declaring Phase 4 operationally complete.

## Status ledger

A00: documentation baseline prepared; no source/product acceptance implied. Remaining issues are Backlog until scoped claims and acceptance evidence are recorded. Older issues #5–#10 and #18 may contain historical **Review/Backlog** bodies despite #14/#15/#19/#20 being merged; update historical descriptions without prematurely closing unresolved acceptance work.
