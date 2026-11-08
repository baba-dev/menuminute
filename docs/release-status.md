# Release status and issue reconciliation — 9 November 2026

> **Source of truth for current release policy.** This document supersedes the _release-blocking status_ of the October Phase 4/5 planning and acceptance documents, not their engineering contracts, security safeguards or historical test records. Do not mistake the owner's policy decision for a completed test, certified jurisdiction, provider approval, or current VPS verification.

## Owner decision and scope

The product owner states that **the general MenuMinute web release blockers are lifted** as of 9 November 2026. Free QR menus, guest ordering, standard POS, service orders and multi-station Kitchen Pro are implemented rather than pending Phase 4/5 development. Release and merchant availability must follow actual role, plan, entitlement, provider and configuration checks rather than stale cross-phase approval tickets.

The earlier Phase 4/5 _epic-level launch holds_ are superseded; they must not be reused to disable otherwise authorized web functionality. This is **not** a waiver of tenant isolation, order correctness, immutable migrations, runtime health, backup safety, payments verification, privacy, fiscal law, or security reviews. Outstanding independent QA/operations evidence is a **tracked post-release risk**, not evidence of having passed. Never mark unchecked historical acceptance boxes as complete.

## Verified repository versus live deployment

- Repository main inspected for this reconciliation: `008c7aefa1c9434d0d2911168d1b9e862604b744`. Recent merged work includes [#321](https://github.com/baba-dev/menuminute/pull/321) (live merchant-tax quotes), [#306](https://github.com/baba-dev/menuminute/pull/306) (standard POS availability), [#313](https://github.com/baba-dev/menuminute/pull/313) (activation diagnostics), [#331](https://github.com/baba-dev/menuminute/pull/331) (mobile diner polish), [#335](https://github.com/baba-dev/menuminute/pull/335) and [#339](https://github.com/baba-dev/menuminute/pull/339) (workspace polish), [#338](https://github.com/baba-dev/menuminute/pull/338) (Android foundation), [#342](https://github.com/baba-dev/menuminute/pull/342) (Play Billing boundary) and [#344](https://github.com/baba-dev/menuminute/pull/344) (upload signing verification).
- The signed Android AAB workflow [#42496478422](https://github.com/baba-dev/menuminute/actions/runs/42496478422) succeeded per issue #340. This is **not** Google Play publication or a verified installed app.
- The live public home, features, pricing, docs and account-deletion pages were read on 9 November. The public pricing page advertises ₹119 Ordering and ₹499 Kitchen Pro. That does **not** independently prove authenticated payment completion or provider settlement.
- The public `/.well-known/assetlinks.json` returned **HTTP 503** on 9 November, pending the correct Play App Signing fingerprint. Do **not** describe Android TWA verification or Play launch as complete.
- The latest **actual** web/worker deployed SHA, host Node version, signed edge configuration, isolated SQL+media restore and measured ERP coexistence were not established during this remote GitHub/public-web reconciliation. Verify these separately; source and GitHub issue states are not host evidence.

## Product and commercial boundaries

| Area                           | Current source/policy status                                                       | Still restricted or unverified                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Free QR Menu / publishing      | Delivered; no inherited Phase 4 blocker                                            | Auth, tenancy, media approval, valid QR and safe publish contracts remain mandatory                                        |
| Guest ordering / service board | Delivered, including free-tier quotas and merchant entitlement flows               | Outlet hours, price reconfirmation, active entitlements, staff permissions and runtime availability still apply            |
| Standard POS / receipts        | Delivered; legacy finance gate must not suppress ordinary cashier service          | External payment settlement and certified fiscal documents are **separate** features                                       |
| Kitchen Pro                    | Multi-station implementation delivered; owner says general release hold lifted     | Billing must still pass provider, plan, entitlement and database authorization checks; no fabricated transaction readiness |
| Merchant-configured tax        | Guest/POS server quote, frozen snapshots and non-fiscal receipts delivered in #321 | Merchant explicitly enables tax collection after required classifications; not certified GST/VAT invoicing                 |
| AI menu import / Ember         | Feature-specific controls and some workflows delivered                             | Provider readiness, monetary limits, privacy, consent, role permissions and scoped AI actions remain independent           |
| PWA / Web Push                 | Source delivered                                                                   | Physical-device acceptance and push rollout in #249 are not proven globally                                                |
| Android / Google Play          | TWA source, compliance documentation and signed AAB built                          | #340: identity, App Signing assetlinks, Play tracks, Data Safety, device QA and store review; #286 deletion validation     |
| Statutory invoices             | India GST draft/ledger work in #318/#320                                           | #226 legal/jurisdiction review and actual statutory issuance remain fail-closed                                            |
| USD subscriptions              | USD prices/contract inquiries published                                            | Do not imply verified live international recurring checkout without the provider integration and approval                  |

## Issue disposition

The following statuses mean **implementation delivered** and support closing the old implementation issue with a reference: [#329](https://github.com/baba-dev/menuminute/issues/329) via PR #331 and [#315](https://github.com/baba-dev/menuminute/issues/315) via PR #321. A merchant must still enable tax collection within its supported policy.

The following October release-epic holds are **superseded by owner decision**, not retrospectively accepted: [#37](https://github.com/baba-dev/menuminute/issues/37), [#50](https://github.com/baba-dev/menuminute/issues/50), [#67](https://github.com/baba-dev/menuminute/issues/67) and [#77](https://github.com/baba-dev/menuminute/issues/77). Their unexecuted QA/ops steps are not automatically checked off. [#49](https://github.com/baba-dev/menuminute/issues/49) and [#131](https://github.com/baba-dev/menuminute/issues/131) already show GitHub **closed**, even though their historical descriptions still say “OPEN”; closed status is not a restoration transcript.

Retain as **post-release work, not general web-launch holds**: [#47](https://github.com/baba-dev/menuminute/issues/47) cross-domain QA, [#76](https://github.com/baba-dev/menuminute/issues/76) device/load/independent quality, [#312](https://github.com/baba-dev/menuminute/issues/312) remaining activation diagnostics after the #313 implementation slice, and [#326](https://github.com/baba-dev/menuminute/issues/326) residual security validation after #328/#330/#332.

Retain as **independently gated capabilities**: [#226](https://github.com/baba-dev/menuminute/issues/226) statutory fiscal adapters, [#230](https://github.com/baba-dev/menuminute/issues/230) paid AI/privacy/actions, [#249](https://github.com/baba-dev/menuminute/issues/249) device push rollout, [#286](https://github.com/baba-dev/menuminute/issues/286) verified account erasure and native-store requirements, and [#340](https://github.com/baba-dev/menuminute/issues/340) Google Play publication.

## Documentation usage

- This file: **current owner release decision** and its explicitly limited verification.
- [Product roadmap](product-roadmap.md): delivered modules and actual next work.
- [Commercial availability](commercial-availability.md): live pricing/sale-switch contract, not a blanket “not launched” rule.
- [Feature activation](feature-activation.md): diagnostic signals; configured is not confirmed ready.
- [Production runbook](production-runbook.md): operational procedures and historical evidence, which must be refreshed from the host.
- [Phase 4](orchestration/phase-4.md) and [Phase 5](orchestration/phase-5.md): **historical implementation contracts and acceptance matrices**, not present-day commands to close web access.
- [Android release](android-release/README.md): separate store-distribution policy; not covered by lifting web release blocks.

**Reconciliation rule:** close verified code-complete tasks, record owner-superseded launch gates without pretending tests passed, and keep true compliance/security/device work explicitly open. A future incident may independently disable a subsystem through its documented fail-closed controls.
