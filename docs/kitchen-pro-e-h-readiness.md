# Kitchen Pro E–H — release evidence and operational handoff

**Status: code under development, launch BLOCKED.** This document does not certify a production deployment, an independent security sign-off, restored backup or ERP load. Parent PR [#122](https://github.com/baba-dev/menuminute/pull/122), Phase 5 [#67](https://github.com/baba-dev/menuminute/issues/67), [QA #76](https://github.com/baba-dev/menuminute/issues/76), [release #77](https://github.com/baba-dev/menuminute/issues/77), prerequisite Phase 4 [#49](https://github.com/baba-dev/menuminute/issues/49).

## Invariants and implementation decisions

- PR #79's PostgreSQL order and its order-status event/outbox remain authoritative. `0013` is immutable; append-only `0014_kitchen_expo_hardening` introduces the sole expeditor Ready command, scoped command receipts, transfer history and bounded views. New accepted kitchen orders require both the enabled outlet flag and a valid `kitchen.new` entitlement. Expiration after acceptance must not strand already cooking food.
- Outlet settings default **disabled**; web/admin APIs expose only `settings.disable`. A new commercial enable endpoint is expressly out of scope. No production fixture, synthetic guest order or paid-provider call is permitted in this source PR.
- In a dedicated isolated test DB, migration-owner fixtures may enable an outlet; this is **not** a commercial activation. User commands cannot directly update private kitchen tables. Expeditor checks `orders.complete`, current membership, canonical order version, nonempty station work and *all* task states complete. A successful release writes the canonical Ready status event and order outbox transactionally, without charging a payment.
- The same request UUID plus actor/target/version/payload returns its committed result. Reusing the key with different input is rejected. A transfer retains the immutable ticket id and writes append-only old/new station, actor, version and reason history. A manager can move only queued/preparing work before a terminal order. Terminal cancellation invalidates active station work transactionally.
- PostgreSQL commits work and cursor events; Redis/BullMQ is not a ledger. Readable snapshots and SSE are private, revalidate identity/permissions and contain no guest contact details. Station snapshots have a 500-work ceiling and explicit overflow, expo shows the 60 oldest active orders plus explicit overflow, changes return at most 100 ordered events. SSE has a 55-second lifetime and a per-process maximum of two simultaneous connections per session/outlet; enforce *global* rate limits separately in the edge/gateway. Cursor loss triggers full snapshot reconciliation.
- Owner, admin and outlet manager can configure routes/staff and use expeditor where `orders.complete` permits; kitchen-only members see only assigned tickets, not expo or all-station data. The merchant board identifies kitchen-managed orders and cannot directly bypass expeditor. QR-only non-KDS outlets preserve their previous order transitions.

## Independent review required (not self-approved)

The only committed CODEOWNER is `@baba-dev`. Obtain a distinct qualified reviewer for these items and link their submitted GitHub review before merging:

1. SECURITY: SECURITY DEFINER search_path, current actor/outlet lock, grants/RLS including function execute grants, guest PII omission, session role revocation, station-to-station and cross-outlet mutation denial, CSRF/origin checks on all writes.
2. CORRECTNESS: lock ordering (orders before work), accept/expire race, cancellation while preparing, optimistic version conflicts, retry-key collisions/expiry, partial delivery, expeditor all-complete predicate, reversal/reassignment to occupied station and order-state history.
3. OPERATIONS: `0013` historical checksum unchanged, `0014` expand-only and mixed web/worker compatibility, retry safety, outbox receipt, event retention, bounded reads, SSE connections, upstream proxy timeout, shutdown/reconnect and ERP isolation.
4. UX/A11Y: mobile/tablet light/dark, touch targets, keyboard/focus and reduced motion, clear failure/unknown states, accessible ticket timers/status/progress, audible notifications opt-in, merchant-to-expeditor and guest fulfillment semantics.
5. COMMERCE: launch geography/tax, entitlement pricing and sales/chargeback policy are separate owner decisions. No guessed subscription price.

## Verification matrix — populate using observed evidence only

| Gate | Required evidence | Status |
| --- | --- | --- |
| Latest merged-tree ARM64 CI | Exact full SHA and four lane results plus quality gate | Pending this PR's final SHA |
| Migration compatibility | `0013` unchanged; `0014` passes empty/upgrade isolated PostgreSQL, helper v6 and checksum guard | Pending final CI and operator preflight |
| E expeditor + merchant/guest | Multi-station PostgreSQL tests, Playwright, Ready only after complete, independent payment | Pending final CI |
| F isolation and failures | Cross-tenant, revoked device, duplicate commands, cancellation, transfer history, Redis/network-loss/reconcile | Pending complete failure-injection review |
| G repeatable capacity | Run `infra/load/kitchen.js` only on approved disposable nonproduction dataset and external k6 generator; record load-generator spec, data, arrival mix, run timestamp and SHA | Unrun |
| Shared ERP and host | Measure ERP p50/p95, HTTP status, PM2 RSS, MenuMinute CPU/RSS, Postgres pools/locks/WAL, Redis memory, disk/inodes, SSE active count and recovery before/during/after load | Unrun / operator required |
| SQL + private-media restore | Fresh remote restic snapshot before `0014`, isolated matching SQL/media restore using a consistent approved write barrier/reconciliation; verify QR/media and publish, do not restore onto live | Unverified / operator required |
| Off-host backup and alerts | Nightly timer execution, retention, remote visibility and non-destructive alert test | Unverified / operator required |
| Exact release identity | web/worker current symlinks point to same 40-char SHA, artifact SHA-256 and source CI; `/api/health/ready` and public SHA match | Unrun |
| Controlled live outlet | Independently approved disposable test outlet, owner/manager/station/expo device, guest QR and counter settlement; cleanup only through supported controls | Unrun / owner approval required |
| Independent security/accessibility sign-off | Submitted review by a distinct reviewer, outstanding threads resolved | Pending |
| Commercial activation | Owner-approved pricing, supported jurisdiction policy, SLO, incident owner and signed gate; **not implemented/exposed** | Blocked |

## Operator preflight — non-destructive, no credentials in output

Follow [current automatic migration helper v6 policy](automatic-migration-deployment.md), [production runbook](production-runbook.md) and [Phase 4 ops evidence](orchestration/phase-4-ops-evidence.md). Source PRs cannot install root helpers, change GitHub environment protections or inspect private production backup credentials.

Capture date, exact commit and action URLs, plus **statuses only**:

```bash
date -Is
readlink -f /var/www/menuminute/current
readlink -f /var/www/menuminute/worker-current
/usr/local/sbin/menuminute-release --version
systemctl is-active menuminute-web.service menuminute-worker.service
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3100/api/health/ready
curl --fail --silent --show-error --max-time 20 -o /dev/null -w 'ERP HTTP %{http_code}\n' https://erp.bababuilds.com/
df -h / /var/lib/menuminute/media
df -i / /var/lib/menuminute/media
```

Verify both persistent Redis workloads separately, an exact SHA-and-digest staged archive, source CI, helper migration dry-run, permission traversal for web/worker and latest main before activation. Helper v6 must take a **new verified off-host backup** before executing `0014`; if migration fails, stop before cutover. After new SQL, **never** claim SQL rollback: app-only fallback is permitted solely when schema-compatible; otherwise forward repair using a tested migration and restored *isolated* evidence. Do not change the ERP PM2 process, its Node installation or global Nginx/firewall.

## Load and failure-injection protocol

`infra/load/kitchen.js` models 1,000 attempted guest orders per hour plus concurrent merchant and kitchen reads for a **nonproduction** disposable fixture. It is an exploratory harness, not proof of 50-outlet peak or shared ERP health on its own. Configure synthetic guest data from an actual *server-verified published quote*, browser-authorized owner cookie and known outlet; do not log those inputs. Exercise 25 owners/50 outlets separately with a seeded staging dataset, staff commands and device reconnection across two Redis services. Before/after capture:
- order count, duplicate request keys, orphaned/unrouted work, non-terminal tickets, outbox backlog and retry receipts;
- guest/merchant/kitchen p50, p95, p99, errors, overload recovery and SSE disconnect/reconnect outcomes;
- two Redis disruptions independently (cache loss must not erase orders; queue loss must recover from outbox), web/worker restart and revoked session/station;
- measured CPU/RSS, PostgreSQL lock duration, disk/WAL and ERP HTTP/latency under representative ERP work.

Fail immediately for unauthorized access, lost committed orders, false Ready, duplicate work, corrupted original receipts, ERP incident or an unverified backup. Numeric resource/SLO thresholds must be approved by the owner before signoff; a CI-green PR alone cannot settle the decision.

## Activation and operator handoff

1. Keep `kitchen_outlet_settings.enabled = false` for **every production outlet** while any gate above remains pending. No `settings.enable` exists in the web contract. A manual SQL toggle is not an acceptable bypass.
2. After distinct reviewer approval, approved commercial policy and measured failure/load/restore evidence, authorize a *separate*, reviewed, narrowly scoped operator activation workflow with an explicit test outlet allowlist and audit. Validate an initial test outlet before any customer flag; do not activate from this PR by assumption.
3. Record last-good order and kitchen cursor, last off-host snapshot and exact web/worker SHA, DNS/Cloudflare/Nginx readiness, ERP before/after and on-call/forward-repair contact. Preserve successful orders even when SSE/Redis are unavailable and reconcile from PostgreSQL after reconnect.
4. Post the evidence URLs against [#76](https://github.com/baba-dev/menuminute/issues/76) and [#77](https://github.com/baba-dev/menuminute/issues/77). Close these only after owner/operator verification, not on docs or CI alone.
