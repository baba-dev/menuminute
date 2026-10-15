# Dependency-linked development backlog

Tracker: [Phase 0 epic #5](https://github.com/baba-dev/menuminute/issues/5). Created 2026-10-15.
All downstream tasks begin in Backlog, with sessions and reservations unassigned. Issues are the
live status source; this table records dependency intent. Each broad slice is split into complete
work packages before Ready; do not start a whole slice as an unbounded multi-agent task.

| Issue                                                   | Slice / outcome                                 | Required predecessors / gates                                   | Safe parallel preparation                             |
| ------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- |
| [#6](https://github.com/baba-dev/menuminute/issues/6)   | A1 foundation contracts and migration plan      | Phase 0 merged                                                  | UX fixtures and QA/ops planning                       |
| [#7](https://github.com/baba-dev/menuminute/issues/7)   | A2 PostgreSQL, Better Auth and tenant isolation | #6 contracts merged; shared-path reservations                   | Independent UI and acceptance scenarios               |
| [#8](https://github.com/baba-dev/menuminute/issues/8)   | Product/UX/calculation/entitlement decisions    | Product-owner review                                            | Can begin after Phase 0, alongside #6                 |
| [#9](https://github.com/baba-dev/menuminute/issues/9)   | B durable jobs and queue-loss recovery          | #7 transaction/tenant contracts                                 | Menu work after shared interfaces are stable          |
| [#10](https://github.com/baba-dev/menuminute/issues/10) | C menus, QR and onboarding                      | #7; affected #8 decisions; #9 for processing                    | Orders contract preparation, no fake runtime proof    |
| [#11](https://github.com/baba-dev/menuminute/issues/11) | D ordering and kitchen recovery                 | #7 + #9 + #10; affected #8 decisions                            | Reserved UI/E2E tasks against accepted contracts      |
| [#12](https://github.com/baba-dev/menuminute/issues/12) | A–F QA, ARM64 coexistence and release evidence  | Planning after Phase 0; execution after relevant runtime slices | Cross-domain acceptance matrix and operational inputs |
| [#13](https://github.com/baba-dev/menuminute/issues/13) | E reviewed media/AI and UI refinement           | #7 + #9; stable #10 contracts; UX/asset approval                | Separate UI and provider tasks with separate claims   |

## Initial batch after Phase 0 merge

The integration owner can prepare #6, #8 and the planning portion of #12 concurrently using separate
checkouts and disjoint reserved paths. Implementers/reviewers are assigned at kickoff; these tasks
are not currently claimed. #7 waits for #6. Data and identity implementation share a coordinated
migration sequence rather than independent schema branches. #9 and menu sub-tasks can later run
concurrently once their producer contracts and write reservations permit it.

## Unresolved inputs and affected gates

| Input                                                                                 | Decision owner                  | Blocks                                       |
| ------------------------------------------------------------------------------------- | ------------------------------- | -------------------------------------------- |
| Pickup identity/contact, ASAP/scheduled and missed collection                         | Product owner in #8             | Affected #10/#11 flows                       |
| Modifier/combination examples, tax jurisdiction and rounding                          | Product owner in #8             | Authoritative calculation/order release      |
| Plans, quotas, trial/grace and billing operations                                     | Product owner in #8             | Entitlement implementation/commercial launch |
| Full failure-state UX and exact visual tokens                                         | Product owner/UI review in #8   | Affected UI implementation/acceptance        |
| OCI/domain, ERP peak headroom, backup/retention, SLO/RPO/RTO and peak load thresholds | Product owner/operations in #12 | Infrastructure sizing and public release     |

Foundation contracts may proceed without pretending these inputs are resolved. Free QR continuity,
worldwide outlet currencies, USD/INR platform billing, staff acceptance, no business quantity cap,
ARM64 and approved design hierarchy remain binding. See [product requirements](../product-requirements.md).
Artwork [PR #4](https://github.com/baba-dev/menuminute/pull/4) remains an independent review dependency,
not a prerequisite for PostgreSQL/identity work.
