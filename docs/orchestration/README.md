# Phase 0 — Development orchestration

Prepared 2026-10-15. This package makes development assignable and reviewable. It changes no
runtime behavior and does not establish production readiness. PR #2 remains the approved product
and architecture baseline; [implementation slices A–F](../implementation-plan.md) remain intact.

## Start here

1. Read [AGENTS.md](../../AGENTS.md), [product requirements](../product-requirements.md),
   [architecture](../architecture.md) and [invariants](../domain-invariants.md).
2. Select a dependency-ready issue from the [backlog](backlog.md).
3. Fill the [agent contract](agent-contract.md), claim paths and record the starting SHA.
4. Follow [ownership](ownership.md), [architecture contracts](architecture-contracts.md) and
   [delivery process](delivery-process.md).
5. Hand off exact changes and evidence; the integration owner checks the final rebased SHA.

## Operating roles

| Role                                           | Accountability                                                                      |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Product owner — @baba-dev                      | Product decisions, unresolved commercial/UX inputs, release authorization           |
| Integration owner — appointed per active batch | Ready queue, reservations, contract coordination, merge sequence and final evidence |
| Domain implementer — named session per issue   | One bounded task, implementation, tests, migrations and handoff                     |
| Independent reviewer — separate session/person | Challenge correctness, isolation and failure paths; author cannot self-approve      |
| QA/security/operations contributor             | Cross-domain scenarios and release evidence; does not bypass domain ownership       |

These are development responsibilities, separate from merchant roles. Agent names are session
identifiers, not GitHub usernames or invented teams. CODEOWNERS routes GitHub review to the actual
maintainer; it cannot assign an AI session or enforce reservations.

## Phase 0 acceptance

- [x] Agent task and handoff contracts documented.
- [x] Existing paths mapped to owners; future paths explicitly identified.
- [x] Shared-file reservations and interface-change protocol defined.
- [x] Architecture boundaries, migration ownership and failure contracts defined.
- [x] GitHub issue/PR templates and maintainer review routing provided.
- [x] Dependency-aware launch backlog and unresolved input gates recorded.
- [ ] Phase 0 PR merged with required final-SHA CI evidence.
- [ ] First batch integration owner and task sessions appointed; reservations recorded before edits.

Repository rules/required reviewers are not configured by this package. The integration owner must
inspect actual branch protection before relying on enforcement. No deployment is part of Phase 0.
