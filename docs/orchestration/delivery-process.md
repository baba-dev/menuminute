# Issue, review and release process

The GitHub issue backlog is the initial project tracker. No GitHub Projects board, milestones,
labels or branch-protection settings are claimed to exist from these files. A future board can use
these same fields without duplicating task truth.

## Workflow

| State       | Entry / exit rule                                                                              |
| ----------- | ---------------------------------------------------------------------------------------------- |
| Backlog     | Scoped outcome exists; missing decisions/dependencies listed                                   |
| Ready       | Acceptance, contract version, owner lane and dependency evidence supplied; no blocking input   |
| In progress | Named session + branch/base SHA; paths reserved; one active implementation task/session        |
| Blocked     | Exact blocker, dependency/decision owner and next action recorded; release unused reservations |
| Review      | Complete handoff + PR; independent reviewer and final-SHA evidence requested                   |
| Done        | Accepted PR merged; issue closed; downstream contract/backlog and reservations updated         |

Keep Status, Lane, Priority (P0 safety blocker / P1 launch / P2 later), Blocked by, Owner session,
Reviewer, Branch/PR and Reservations in the issue body. “Ready after X” is not Ready until X merges
or an explicitly versioned contract is accepted. Do not mark planning checkboxes as runtime evidence.

## Batch planning and safe parallelism

The integration owner refreshes main/open PRs and chooses the smallest dependency-ready batch.
At first, data and identity share schemas: sequence their contract work rather than allowing
competing migration writers. In parallel, UI may prepare fixture-backed flows, QA may prepare
acceptance scenarios, and operations may prepare coexistence/recovery plans in reserved paths.
Durable jobs follow the foundation transaction contract; menus follow tenant/session contracts;
orders follow quote, money and outbox contracts. KDS recovery follows durable order events.

Use a PR per complete task. Dependency PRs may stack temporarily, with explicit base/merge order;
retarget and rerun on main before final acceptance. Avoid one enormous “all agents” merge.

At each handoff or working-day end, publish progress, blockers, SHA and reservation renewal/release
in the issue. No requirement for noisy periodic automated comments. On a blocker, work on an
independent scoped task only after releasing/recording the old claim.

## Review and merge checklist

- Product behavior, invariant and task scope match the issue.
- Independent diff review covers authorization, concurrency, failure and migration paths.
- Documentation-only: changed Markdown formatting, local links and `git diff --check`.
- Runtime: lint, strict typecheck, relevant tests and ARM64 production build. Affected browser flows
  require E2E evidence. PostgreSQL/Redis scenarios use real isolated dependencies once implemented.
- Current CI lanes are Lint & Code Style, TypeScript Strict Typecheck, Unit & Integration Tests
  (SQLite), Production Build (ARM64). These validate the scaffold; they do not prove target RLS,
  outbox recovery or production readiness. Add integration gates in the foundation implementation.
- Check runs must match the latest rebased commit; a predecessor's green run is insufficient.
- No bypassing failures, self-approvals or untested capacity claims. Explain baseline failures.
- Integration owner verifies dependencies, shared-file reservations, rollback and no stale consumers.

The integration owner merges only within the user's authorized scope. Phase 0 is submitted as a
reviewable PR; beginning orchestration does not itself authorize deploying the application.

## Release and escalation

Production release is separate from task completion. Follow [deployment](../deployment.md),
[testing](../testing-strategy.md), [operations](../operations.md) and the audited ARM64 coexistence
plan. Resolve SLO/RPO/RTO, backup destination, ERP resource headroom, monitoring and restore evidence
before public launch. Record deployed artifact SHA and rollback decision; never build on the ERP host.

Escalate product gaps to @baba-dev in the issue; architecture conflicts to the integration owner
with an ADR proposal; data/security failures block affected merges. Do not infer new pickup rules,
commercial quotas, tax behavior or legal compliance to unblock implementation.
