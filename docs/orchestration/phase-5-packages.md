# Phase 5 scoped work packages and multi-agent execution

Parent [#67](https://github.com/baba-dev/menuminute/issues/67). These are **Backlog issues**, not authorized active reservations or evidence of delivery. Existing agent contract and single-writer rules remain authoritative. Owner choices B/C/C are recorded in [Phase 5](phase-5.md).

## Execution map

| Work package / issue                                          | Agent lane, intended ownership                     | Producer dependency                                          | Proposed exclusive files / interface boundary                                                   | Deliverable / consumer                                                               |
| ------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| [P5-00 #68](https://github.com/baba-dev/menuminute/issues/68) | Integration + product                              | Existing approved policy, Phase 4 status                     | New Phase 5 docs and decision fixtures only                                                     | Versioned decision ledger, exact blocked rules                                       |
| [P5-01 #69](https://github.com/baba-dev/menuminute/issues/69) | Design/UI sole shared-style writer                 | P5-00 screen flows                                           | New phase-5 components, dedicated CSS, shared style/layout only after explicit claim            | Rendered guest/staff/kitchen primitives and screenshots                              |
| [P5-02 #70](https://github.com/baba-dev/menuminute/issues/70) | Orders contract + **single data/migration writer** | P5-00 applicable quote/tax fixtures; existing menu/tenancy   | `src/db/schema/**` and additive migration; `src/modules/orders/contracts*`/quote                | Versioned quote, order command/result, event envelope, Zod/errors and migration plan |
| [P5-03 #71](https://github.com/baba-dev/menuminute/issues/71) | Orders service owner                               | Merged P5-02                                                 | `src/modules/orders/**`, owned new API, scoped job adapter claim                                | Authoritative idempotent submit, pending lifecycle, expiry, guest status and resync  |
| [P5-04 #72](https://github.com/baba-dev/menuminute/issues/72) | Guest UI owner                                     | P5-01; P5-02 fixtures; P5-03 for integration                 | Existing `public-menu.tsx`, dedicated guest/cart modules and styles; menu/QR producer read-only | Editorial guest discovery, customization, quote/cart/confirm/recovery                |
| [P5-05 #73](https://github.com/baba-dev/menuminute/issues/73) | Staff UI owner                                     | P5-01 + P5-03                                                | Orders dashboard route and dedicated staff components                                           | Authorized outlet inbox and lifecycle controls                                       |
| [P5-06 #74](https://github.com/baba-dev/menuminute/issues/74) | Kitchen domain producer                            | P5-02/03 + P5-00 station rules                               | `src/modules/kitchen/**`; schema only through P5-02 data-owner handoff                          | Station/routing/work/expeditor contract, idempotent item-level projections           |
| [P5-07 #75](https://github.com/baba-dev/menuminute/issues/75) | KDS UI and device owner                            | P5-01 + P5-03 + merged P5-06                                 | `src/app/kitchen/**`, dedicated station/expo components                                         | **Complete first-release** prep+expo+recovery interface                              |
| [P5-08 #76](https://github.com/baba-dev/menuminute/issues/76) | Independent QA/security/ops                        | Starts P5-00, verifies all integrated packages               | Separate scenario/fixture test paths, acceptance evidence; CI only with platform claim          | Real PG/Redis, ARM64, browser/a11y, failure/race/load, ERP evidence                  |
| [P5-09 #77](https://github.com/baba-dev/menuminute/issues/77) | Integration/release owner                          | P5-02..08, signed Phase 4 #37/#49/#50, sale/commercial gates | Integration docs and separately approved release actions                                        | Exact final SHA, reviewed migrations, full multi-station guarded rollout             |

Actual owner/session and reserved paths are set per issue by the accountable integration owner for <=24 hours. One writer for `src/db/**`, `package.json`/`pnpm-lock.yaml`, global CSS/layout, authentication, CI, shared worker and migration histories. Do not invent GitHub teams or assign an unnamed agent as a real collaborator. Independent reviewer may inspect concurrently but cannot alter the claimed code. All agents read [AGENTS.md](../../AGENTS.md), [agent contract](agent-contract.md), [ownership](ownership.md) and [delivery process](delivery-process.md) first.

## Critical path and permitted parallelism

```text
P5-00 decision/fixtures ─────┬── P5-01 rendered UI primitives ──┬─ P5-04 fixture-based guest UI ─┐
                            │                                  ├─ P5-05 staff UI (after P5-03) ┤
                            └── P5-02 quote/order/event contract ─ P5-03 order/lifecycle ─┤
                                                       │                                    │
                                                       └──── P5-06 station/work producer ── P5-07 KDS/expo UI ─┤
P5-08 independent QA/security/ops (continuous) ──────────────────────────────────────────────────────────────┤
Phase 4 signed gates + resolved jurisdiction/commercial prerequisites ──────────────────────────────────────┤
                                                                                                         P5-09 integration/release
```

The visual team may prepare simulated interfaces before P5-03/06 but must label fixtures and replace simulated actions with real versioned commands before acceptance. P5-06 may work in parallel with staff/guest consumers **after** P5-02/03 interfaces are stable and any schema changes are exclusively reserved. P5-06 and P5-07 are one **release capability**, not an incremental single-screen-only Kitchen Pro launch. P5-08 checks each PR and integrated final main.

## Contract boundaries before code integration

1. **Menus -> quote**: authorized outlet and immutable release references; selection/availability/schedules, flat variant and add-on constraints, checked ISO money, local overrides, stale/changed quote, rate/error semantics; release/draft distinction. No guest-provided authoritative prices.
2. **Orders -> guest and staff**: scoped idempotency result, canonical request hash, immutable order/ticket/items and currency, expected-version commands, deadline and terminal reasons; explicit `submitted` vs staff `accepted`; guest tracking capability scope, service status separate from independent payment state.
3. **Orders/outbox -> KDS**: stable organization/outlet/aggregate/version/cursor/event identity and schema version, at-least-once delivery; accepted event and canonical item snapshots only; duplicate and gap/replay/full-resync contract; no trust in Redis as order ledger.
4. **Kitchen -> prep/expo**: route rule version, station authorization, per-work identity, work-item state, completion aggregation and expeditor release; audit reassignment/cancel, no double-complete, rollback after ambiguous result, prevent premature Ready. Shared-brand within one organization only.
5. **Billing -> order**: server-evaluated ordering entitlement gates only _new_ work; free menu/printed QR persist; accepted tickets can complete even after downgrade.

Producer PR supplies concrete TypeScript/Zod input/output/errors, transactional owner, compatibility version, example consumer and real integration fixture. Changes require additive contract PR first, listed downstream consumers and coordinated single-writer migrations. No circular import/direct other-domain-table writes.

## UI work-package definition of done

Real screenshots **inside each source PR**, not a separate sign-off document. At each responsive breakpoint (360/390/768/1024/1440 and KDS landscape), evidence for Light/Dark/System, first paint and preference persistence, long/Hindi item names, image missing/loading, 200% text zoom, keyboard/focus, reduced motion, 44px+ touch and appropriate screen reader announcements. Guest: editorial imagery and high-quality fallback, filtering/category rail, product sheet, one clear cart action and connection/price-change/uncertain-submit recovery. Staff: calm inbox with expiry reason and pending-vs-accepted. Kitchen: quantity/modifiers/elapsed clocks/connection status + one next action, stable tickets, prep/expeditor distinct, disconnected replay. Accessible semantic statuses never depend on orange/yellow alone. Independent product-owner review of rendered screenshots is part of PR review; no brochure/prototype prerequisite.

## PR and handoff format

Each issue moves Backlog -> Ready only after: named session and separate reviewer; final predecessor SHA/contract; exact claimed file paths and UTC expiry <=24h; current start SHA, isolated branch/worktree; affected user state and failure behavior; tenant/role/entitlement checks; additive migration/rollback; commands/evidence; no-active-writer conflict. End with changed files, exported contracts, executed real tests, screenshot URLs, what remains unverified, and explicit reservation release. Never call docs-only PR runtime completion or public activation. No merges without required final-head four-lane native ARM64 CI and quality gate.
