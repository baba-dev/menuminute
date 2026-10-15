# Agent task and handoff contract

Copy this into a work-package issue before moving it to Ready. A task must name one deliverable,
not “implement the backend”. Follow existing [AI primers](../ai-development-primers.md).

```text
Task ID / issue URL:
Phase / implementation slice:
Goal and user-visible outcome:
Starting main SHA / branch / isolated worktree:
Accountable integration owner:
Implementer session / independent reviewer session:
Status: Backlog | Ready | In progress | Blocked | Review | Done
Dependencies (issue links + required merged commit or contract version):
Approved product decisions / invariant references:
Current implementation and observed baseline:
Owned write paths (exact files or bounded directories):
Read-only dependencies / explicitly excluded paths:
Shared-file reservation (holder, paths, start, expiry, integration acknowledgement):
Input/output contract version and producer/consumer:
Success / error / timeout / retry / concurrency behavior:
Tenant, role, outlet, guest and entitlement boundaries:
Migration, compatibility and rollback strategy:
Acceptance criteria (observable scenarios):
Validation commands and required environment:
Out of scope / unresolved decision gates:
```

## Claim and reservation protocol

The integration owner is the single reservation writer and records acknowledged claims in issue
bodies. A comment requesting a claim is not a claim. Before editing, verify there is no other active
claim for the same paths. A reservation lasts one working session, at most 24 hours, and must state
an exact expiry instant. Renew explicitly. Expiry never authorizes overwriting unmerged work: the
integration owner inspects branch/PR state and reassigns or releases the claim first.

Use one branch and isolated checkout/worktree per task, for example
`work/<issue-number>-<short-scope>`. Never share a mutable checkout between agents. Commit and push
checkpoints; another session resumes only after handoff. WIP limit: one implementation task per
session, one writer per shared path. Independent review can run concurrently using a separate checkout.

If an unexpected file/interface must change, stop edits to that area, record the reason and obtain
an updated claim from the integration owner. Continue independent in-scope work. Never silently
expand scope or repair another agent's branch.

## Completion handoff

```text
Issue / PR / final commit SHA:
Behavior delivered and invariants preserved:
Files changed and contract versions produced/consumed:
Migration order / runtime compatibility / rollback:
Commands actually run, result and evidence links:
Failure, concurrency, authorization and recovery scenarios covered:
Untested items and reason / unresolved risks:
Required merge predecessors / downstream consumers:
Reservation release and next action:
```

An independent reviewer must inspect the final diff and evidence. Another session using the same
GitHub account can provide review evidence, but cannot satisfy GitHub's prohibition on author
self-approval. Where a distinct eligible human approver is unavailable, record that limitation;
never fabricate an approval or claim required-review enforcement.
