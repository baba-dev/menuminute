# Phase 5 — executable acceptance and release matrix

Parent [#67](https://github.com/baba-dev/menuminute/issues/67), continuous QA [P5-08 #76](https://github.com/baba-dev/menuminute/issues/76), final integration [P5-09 #77](https://github.com/baba-dev/menuminute/issues/77). All boxes are **pending** until linked to exact real evidence; this planning checklist does not declare Phase 4 or Phase 5 production readiness. The owner approved Guest B / Kitchen C / Design C, not unrecorded tax/pickup/commercial rules.

## Phase 4 hard predecessor (operator, not merely CI)

- [ ] #37/#49/#50 signed with controlled authorized owner -> outlet -> draft/media approval -> publish -> physical QR/guest/revoke flow, independent mobile/theme/keyboard review.
- [ ] Installed nightly backup timer and verified off-host failure alert (date/receipt); **isolated matching SQL + private media restore** with read/publish/QR/media checks; pre/post ERP health, CPU/RAM/disk/WAL and measured coexistence.
- [ ] Web/worker, public readiness and artifact exact SHA recorded; migration tree and rollback guard confirmed. No assumption current VPS SHA from merged main alone.

## Pricing, policy and contract gate

- [ ] Product owner approves applicable jurisdiction tax-inclusive/exclusive, item categories, discounts, service charge, rounding and receipt/retention fixtures; zero/two/three-decimal amount inputs and correct output.
- [ ] Pickup customer name/contact/ASAP/missed collection decisions recorded; scheduled pickup remains disabled until separately specified. 24h outlet business-day cutoff, overnight session deadline and DST examples.
- [ ] Pricing/quote lifetime, changed-price confirmation, order idempotency scope/retention, guest-status capability expiry, multi-station work routing, reassignment and expeditor release defined as versioned inputs/outputs.
- [ ] Commercial plan/quota/trial/grace/billing collection and rollout geography approved before paid/customer live acceptance. Do not advertise historical ₹149/₹299 hypothesis or invent a payment provider.

## Guest editorial menu and ordering

- [ ] Existing immutable published Menu Studio and permanent menu/table QR preserved across outlet/menu/plan/rename changes; explicit revoke clears stale open guest menu on refresh; temporary session never rotates QR token.
- [ ] Search, category rail and merchant-supplied filters; approved actual food photos or original licensed fallback; deterministic honest contextual recommendations with no allergen/ingredient inference; sold-out image/text accessible.
- [ ] 1+ flat variants, required/optional available add-ons, quantity arithmetic/no hidden cap, invalid group rejection; local currency, schedules/overnight, outlet overrides, stale version and sold-out revalidated by server.
- [ ] Accessible configuration sheet and safe-area cart; order quote/review clearly itemizes selected options/tax/total and requires explicit reconfirmation after changed price/availability. No noncommitted result displayed as success.
- [ ] Scoped idempotency lost response/retry returns same ticket; changed payload conflicts; new key creates separate ticket; offline browser can label stale content but never auto-replays a submission.
- [ ] Guest sees committed awaiting merchant acceptance separately from accepted/preparing/ready/served/collected, rejection, cancellation and expiry; no other guest's order exposed.

## Merchant and lifecycle

- [ ] Scoped owner/manager/service staff accept/decline only assigned outlet, kitchen-only role cannot; reasoned cancellation and payment-at-counter records are separately audited from fulfillment.
- [ ] Atomic accept-vs-expire with database clock and stored closing instant; overnight 18:00->02:00, explicit 24h cutoff, after-close accepted work may finish; editing schedules never retroactively moves old order deadline.
- [ ] Change/outbox/audit commit atomic, reorders/duplicate events idempotent, role removal invalidates API and SSE; tenant/brand/outlet isolation with multi-brand cloud kitchen fixture.

## Complete multi-station Kitchen Pro — first release

- [ ] Create authorized 2+ stations and expeditor; menu-to-work routing records rule/version; accepted order fans out exactly one canonical line/work identity per required station task, no duplicate under at-least-once outbox.
- [ ] Station devices see only assigned outlet/station work and clear table/pickup, brand, item quantity, options, notes and elapsed/overdue state; own station prep/complete command checks expected version and role.
- [ ] Independent simultaneous station progress and all-day item counts; station A ready with station B incomplete never makes full order Ready; expeditor shows consolidated status, then authorized full-order release.
- [ ] Reassignment/cancel after accepted work is explicit/audited and reconcilable; no stuck or vanished kitchen work after process crash, retry, Redis loss or duplicate delivery.
- [ ] Reconnect after dropped SSE, missed/out-of-order events, stale/expired cursor, polling fallback and explicit last-sync banner; PostgreSQL reconstructs authoritative snapshot; sound preference/browser permission denial never prevents visible alerts.
- [ ] Tablet landscape + desktop + narrow fallback; Light/Dark/System with optional device override, large touch, accessible focus, no essential status expressed by animation/color/audio alone. No KDS preview marketed as full feature.

## Quality and performance evidence

- [ ] Exact final-head four required native ARM64 lanes + aggregate quality gate: lint/format, strict TS, real PostgreSQL/two-Redis integration, production build & production standalone browser. Immutable artifact SHA/digest provenance retained.
- [ ] Independent reviewer signs off affected invariants; Playwright screenshots at 360,390,768,1024,1440 and KDS tablet landscape, Light/Dark/System and first paint, 200% zoom, keyboard/focus/WCAG AA target, reduced motion, long names/Hindi and 44px touches; no misleading disabled/inert actions.
- [ ] Failure injection: duplicate/lost POST, concurrent accept/expire, worker crash before/after outbox, no Redis, SSE gap, staff/station scope revocation, stale guest QR, blocked/sold out/price-change quote; evidence includes safe recovery behavior.
- [ ] Load envelope baseline 25 owners / 50 outlets / 1,000 orders/hour **planning fixture** plus realistic bursts, simultaneous guest menu reads, station/expeditor device streams and noisy tenant. Agree p95/error/reconnect/backlog/resource targets **before** declaring a performance pass; measure co-hosted ERP alongside MenuMinute.
- [ ] Test outlet full path: guest scan -> quote -> submit -> staff accepts -> station A/B progress -> expeditor releases -> dine-in served or pickup collected, pay-at-counter separately; permissions, snapshots and QR preserved across full round trip.

## Production handoff

- [ ] Phase 4 operational sign-off, affected-region calculation/commercial/entitlement decisions and Phase 5 full QA complete before enabling public ordering/KDS.
- [ ] One integrated final main SHA with four lanes+aggregate passed, publisher archive/digest and exact web+worker/public SHA; autoactivation requires the current v4 root-controlled append-only migration or unchanged-migration guard, exact SHA and backup/ERP preflight.
- [ ] For migration-changing builds, use only the currently audited v4 root-controlled append-only automatic migration path after verified new off-host predeploy PostgreSQL/private-media backup and dedicated migration owner; check its prerequisites and logs. No destructive rewrite of legacy orders or active menu/QR; no automatic SQL rollback; forward-repair documented.
- [ ] Post-release owner/staff/guest/two-station/expeditor controlled smoke; backup/restore/alerts/ERP and headroom still valid; new orders fail closed if entitlement or regional sales rule missing. If any checkbox lacks verifiable evidence, leave P5-09 open and feature flags disabled.
