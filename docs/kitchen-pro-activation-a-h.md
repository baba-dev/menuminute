# Kitchen Pro activation — A–H rollout and operator runbook

**Release boundary:** This PR delivers a guarded **seven-day pilot** workflow. It does NOT commercially launch Kitchen Pro, grant a paid subscription, verify evidence automatically, certify the shared ERP, or authorize any real outlet. Existing Kitchen Pro grant/plan blocks in migration 0015 remain in force. Production activation remains an explicit, separately approved action.

**Dependencies:** [P5 QA #76](https://github.com/baba-dev/menuminute/issues/76), [P5 handoff #77](https://github.com/baba-dev/menuminute/issues/77), Phase 4 production evidence. See existing [Kitchen Pro E–H readiness](kitchen-pro-e-h-readiness.md).

## Implementation contract

| Phase | Shipped design/contract                                                                              | Acceptance evidence                          |
| ----- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| A     | Setup → requested → approved → active → draining → disabled; no client-authored boolean enable       | SQL state/authorization integration          |
| B     | Forward-only 0028; independent session-bound two-operator approval, audit, SHA and tenant separation | Migration checksum + isolated PostgreSQL     |
| C     | Pilot service with Zod commands, SQL authority and bounded seven-day entitlement                     | Non-admin/step-up/replay tests               |
| D     | Admin → Kitchen Control Desk, search, readiness, evidence and in-modal MFA                           | Desktop/mobile keyboard/focus tests          |
| E     | Drain stops new acceptance but keeps enabled flag until outstanding work finishes; disable guard     | Live order/recovery tests                    |
| F     | Manager Kitchen Setup before paid grant; active work access remains scoped                           | Role/tenant/sidebar E2E                      |
| G     | Integration/browser/load/failure matrix                                                              | #76 independent signed results               |
| H     | SHA/checksum/ERP/restore/operator rollout and evidence handoff                                       | #77 operator approval and test-outlet record |

## Invariants

- `kitchen_outlet_settings.enabled` defaults **false**; schema installation and source merge do not activate any outlet.
- Normal `entitlement.grant(kitchen.new)` and Kitchen Pro plan publication remain prohibited by the original SQL control plane. Pilot activation can create a _maximum seven-day_ scoped organization entitlement, only after separate superadmin approval of **one specified outlet**.
- Pilot requestor and approver are **different** superadmin user IDs with verified email, enrolled MFA and live Better Auth sessions. Each new mutation needs a distinct five-minute single-use password + TOTP proof.
- Approval is **SHA- and evidence-specific**, expires after 24 hours, and is unusable for another outlet. Request/approve evidence URLs are links into the repository's issues or PRs, not automatically verified security certifications.
- The application verifies the immutable `/var/www/menuminute/current/RELEASE-SHA` marker against **both** realpath-resolved web and worker release symlinks before activation; missing or mismatched identity fails closed.
- Pilot readiness uses the actual _published menu release_, including assigned cross-outlet menus, active routes, active stations, current scoped staff membership, and active ordering entitlement. A newly published/unrouted dish is blocked by the existing atomic acceptance routing checks.
- `active → draining` retains `enabled=true` until the terminal order state is reached. New order acceptance returns a definitive forbidden response during drain rather than bypassing the Kitchen. `draining → disabled` requires **no accepted/preparing kitchen-managed orders**.
- Existing orders, item snapshots, payment states, historical financial documents, work-event cursors and receipts are never deleted. Outbox/Redis events remain non-authoritative.
- No application/web/worker role receives arbitrary UPDATE rights on Kitchen pilot state or kitchen tables.
- Separate production deployment evidence remains necessary: a CI-green build alone is NOT a release approval.

## Operator checklist — before requesting a pilot

1. Verify the exact `main` SHA/CI artifact and hash, applied migration journal through 0028, web + worker symlinks on that exact SHA, `/api/health/ready`, the immutable `RELEASE-SHA` marker, and pinned runtime/config. Do **not** paste secrets or customer data into issues.
2. Obtain a distinct qualified security/reliability/UX reviewer for the final diff. Link the review in #76, with all blocking threads resolved.
3. Verify a fresh **off-host SQL + private-media backup** and consistent **isolated restore** (never into live). Test QR/media validity and reconciliation.
4. Record representative guest → merchant → stations → expeditor → Ready flows, ordering retry/expiry and cross-tenant/role denial.
5. Record SSE connection/recovery across mobile, browser restarts and separate Redis queue/cache failures. Inspect ordered PostgreSQL events, bounded outbox backlog and staff revocation.
6. Exercise 25 owners / 50 outlets / 1,000 orders/hour with nonproduction fixtures and recorded p50/p95/p99, errors, CPU/RAM, PG locks/pools, Redis usage, disk, worker backlog and shared ERP p95. Owner approves resource/SLO limits and actual measurements.
7. Confirm the owner-approved pilot outlet, incident/on-call owner, planned drain procedure, and jurisdiction/payment policy boundaries. No invented tax or subscription prices.

### Controlled enablement

1. Sign in as an enrolled superadmin; open **Admin → Kitchen Control Desk**.
2. Search by restaurant/organization name; pick the precise outlet.
3. Complete its station/route/staff readiness. Verify Online Ordering is granted through the existing grant workflow. A published dish without an active staffed route blocks pilot activation.
4. Enter exact deployed SHA, link to evidence in #76/#77, an explicit audit reason, password and TOTP; submit **Request pilot review**.
5. A **different** enrolled superadmin independently reviews the evidence and executes **Approve independent review**, using the identical SHA and URL.
6. The operator checks live readiness again, confirms source `/api/health/ready` and deploy SHA, then executes **Activate approved pilot** before the 24-hour approval expires. One seven-day pilot grant is recorded if the organization lacks an active Kitchen entitlement.
7. Open `/kitchen` for the approved outlet. Verify real QR → merchant acceptance → station preparation → expeditor release without creating synthetic data on live. Monitor errors and keep rollback staff available.

### Safe disable / incident response

- **Do not** flip SQL flags by hand, delete events, or allow merchant Ready to bypass expeditor.
- Use **Stop new intake / drain** from Control Desk. Existing work remains enabled and completable; _new pending order acceptance is paused_. Coordinate with the merchant and temporarily pause online ordering intake if necessary.
- Finish or explicitly cancel all previously accepted kitchen-managed orders through canonical workflows. Then choose **Finish drain / disable**. This turns off Kitchen work intake without removing historical tickets or entitlements.
- Re-enabling a disabled pilot requires a new request and an independent approval. An expired entitlement already blocks new Kitchen acceptance; permitted existing station work remains completable.
- On lost API response, refresh the audit/status before retrying. Idempotency prevents same-key different-payload replay; a new privileged action needs a new MFA confirmation.
- SQL migrations are **not** rolled back automatically. Deploy-only rollback requires verified schema compatibility; otherwise forward-repair an independently tested patch.

## Required PR merge evidence

- [ ] Final SHA CI green: formatting, ESLint, strict TS, PostgreSQL, Redis queue/cache, build, Playwright, aggregate ARM64 gate.
- [ ] Isolated migration upgrades and CI privilege/regression/negative tests complete.
- [ ] Independent security/reliability review and UX/a11y approval linked.
- [ ] Restore, load and ERP coexistence measured and attached to #76.
- [ ] Source and deployed SHA consistency proven and operator sign-off attached to #77.
- [ ] No currently enabled customer outlet; no general commercial Kitchen grants.

**Known limitations:** Human evidence URLs are references, not automatic live-system attestations. There is no automatic commercial Kitchen subscription, checkout or customer self-enablement. Pilot grant expiry does not revoke already accepted food work. Operators must retain responsibility for on-call and controlled activation. Keep the PR in draft if any required evidence is pending.
