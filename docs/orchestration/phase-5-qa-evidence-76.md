# P5-08 / #76 — Phase 5 QA and release evidence

**Status: source QA improvement; no production or commercial approval implied.**
Baseline: `main` at merge `d301cae7f6f2620c92fafc7e751441450bc6e119` (PR #225). Source-review/acceptance branch: `qa/issue-76-phase5-evidence`.

## Acceptance evidence hierarchy

1. **Unit / integration (automated)** — isolated PostgreSQL 17 and two Redis servers. Tests of authorization, idempotency, concurrency, kitchen routing, cashier/order lifecycle, stream cursor recovery and regressions. These do not use real customer data.
2. **Browser (automated)** — Playwright desktop/mobile Chromium, controlled synthetic account, normal and Ember-on configurations. Record expected/flaky/skipped/failed counts on the exact tested 40-character SHA. Keyboard, reduced-motion, no audio permission and API outage recovery are reproducible but not a screen-reader certification.
3. **Load / resilience (operator-run)** — pre-agreed nonproduction load environment and explicit owner-approved limits. Measure 1k orders/hour plus a burst across the intended 25 owners/50 outlets with multi-station SSE; restore two Redis instances individually and test worker restart/replay, queue backlog and p95 while ERP runs. Results must include timestamps, measured p50/p95/p99, error count, recovery/backlog duration, CPU, RAM, root disk, WAL and ERP latency. These numbers are **unmeasured** in this PR and should never be invented or inferred from a unit-test duration.
4. **Production acceptance (independent + operator)** — exact deployed web+worker SHA, package digest, migrations, off-host backup+alert receipt, ERP pre/post health, outlet role-revocation evidence, real mobile/tablet/keyboard/screen-reader and 200% zoom, denied-sound UX, and controlled guest→merchant→stations→expeditor→guest Ready→served/collected journey. Human reviewer records dated evidence and launch decision in #77. Previously deferred independent restore proof remains a separately disclosed risk, not a passed check.

All four layers are distinct. Passing (1) and (2) does **not** mark layers (3) and (4) complete.

## Exact source-backed regression matrix

| Risk                                                                  | Existing protection / automated source                                            | #76 follow-up                                                                                                                                                                                    |
| --------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Two stations + expeditor, no early guest Ready                        | `tests/kitchen-pro.integration.test.ts`, `tests/e2e/kitchen-pro.spec.ts`          | New competing station-start and expeditor-release race; assert one Ready audit entry and no payment capture                                                                                      |
| Old accepted→released repair                                          | `tests/kitchen-pro.integration.test.ts`                                           | Retain migration-backed repair test; operator must reproduce on upgraded test outlet                                                                                                             |
| Lost guest response / same-key replay / changed cart conflict         | `tests/online-ordering.integration.test.ts`, `tests/checkout-reliability.test.ts` | Cross-check end-to-end browser and actual reconnect before acceptance                                                                                                                            |
| Cross-tenant and revoked station staff                                | `tests/kitchen-pro.integration.test.ts`, `tests/e2e/kitchen-pro.spec.ts`          | Preserve negative credentials and test revoked live SSE                                                                                                                                          |
| SSE stream cursor pagination / pruned history                         | `tests/kitchen-stream.integration.test.ts`, `tests/kitchen-stream.test.ts`        | Verify real Redis/channel loss and reconnection in isolated operator drill                                                                                                                       |
| Kitchen snapshot outage, stale alert, reduced-motion and sound-denied | `src/app/kitchen/kitchen-board.tsx`, `tests/e2e/kitchen-pro.spec.ts`              | Fix stale transport banner only on authoritative resync; do not dismiss an uncertain staff-command message                                                                                       |
| Orders vs Kitchen Pro separate authority                              | `tests/e2e/kitchen-pro.spec.ts`, `docs/kitchen-live-service-2.md`                 | Operator verifies durable attention dock, stations and historical Orders page together                                                                                                           |
| Actual accessibility and devices                                      | Browser responsive regressions, synthetic Chromium                                | Independent audit with 360/390/768/1024/1440 widths, native touch, focus, 200% zoom, screen reader, noise-muted devices                                                                          |
| Eventual expiry / overnight / scheduled pickup                        | `tests/checkout-reliability.test.ts`, order integration suite                     | Dated cutoffs, timezone and outage samples require real operator acceptance                                                                                                                      |
| Backups / ERP coexistence                                             | `tests/deploy/test_ops_guardrails.py` and production release gates                | Evidence from off-box alert, independent matching SQL+private-media recovery, exact installed services and performance                                                                           |
| Non-production load validity                                          | `infra/load/kitchen.js`, `infra/load/kitchen-contract.mjs`                        | Previous pickup order lacked required time: now a valid dine-in request; exact nonproduction origin, explicit authorized multi-source egress and a 1–15 minute cap. **Load not run in this PR.** |

The matrix identifies **source coverage**, not evidence that each operator step has happened.

## Reproducible automation

Run against the repository's **isolated test database and Redis only**. Do not run load or destructive test bootstrap against a live merchant or the ERP database.

```bash
# On a disposable CI ARM64 runner, with isolated compose.test.yml services:
pnpm install --frozen-lockfile
docker compose -f infra/compose.test.yml up -d --wait
pnpm exec tsx scripts/test-bootstrap.ts
pnpm db:migrate
pnpm build:worker
pnpm test
pnpm build
pnpm exec playwright install --with-deps chromium
CI=true pnpm exec playwright test tests/e2e/kitchen-pro.spec.ts tests/e2e/online-ordering.spec.ts
node --test scripts/qa/phase5-browser-evidence.test.mjs infra/load/kitchen-contract.test.mjs
# GitHub Actions runs the complete test suites, not just the focused commands above.
docker compose -f infra/compose.test.yml down -v
```

`playwright.config.ts` writes a JSON report alongside the GitHub reporter in CI. Both ARM64 browser lanes record **SHA-locked, aggregate synthetic evidence** with test statuses, flaky retries and skips, published as artifacts for 14 days. The evidence summary explicitly sets `productionValidated=false`, `physicalDevicesValidated=false`, `loadP95Validated=false`, `humanSecurityReview=false` and `independentRestoreValidated=false`. The summary command rejects missing or inconsistent statistics, malformed SHA, an unknown lane and an empty suite.

The _exact_ CI run URL and artifact IDs must be linked when claiming automation passed. Do not report CI on a prior SHA as evidence of the latest PR. The production archive still requires the unchanged full repository build/browser quality gate.

## Isolated synthetic load fixture (never run against production)

`infra/load/kitchen.js` offers a k6 **single-outlet exploratory** arrival-rate fixture at 1000 guest submissions per hour plus simultaneous merchant/Kitchen Pro reads; it does **not** simulate the complete approved 25-owner/50-outlet distribution, SSE reconnection, worker loss or ERP contention. Previously, the guest fixture sent `pickup` without its mandatory scheduled instant, creating false failure metrics. The corrected fixture sends a valid unscheduled dine-in order and refuses unauthorized, malformed or production origins before emitting any traffic. **Only loopback or isolated `.test`, `.invalid`, `.internal` or `.localhost` DNS aliases are permitted**, preventing bypass via public hostnames, trailing dots or direct IPs.

Operator supplies all fixture variables: `BASE_URL` (exact origin), `KITCHEN_NONPROD_HOST`, `KITCHEN_LOAD_AUTHORIZED_NONPROD=YES`, `KITCHEN_MULTI_SOURCE_VERIFIED=YES` (actual independent staging egress IPs required because submission throttling is source-based), `PUBLIC_TOKEN`, `ORG_ID`, `OUTLET_ID`, `SESSION_COOKIE`, `DISH_ID` and `QUOTE_MINOR`. `DURATION` is restricted to 1–15 minutes. Never use a live merchant or production host, or fake forwarded IP headers. `k6 run infra/load/kitchen.js` must be invoked separately by an authorized operator on a disposable environment. The k6 output now distinguishes **guest attempts, HTTP 201 committed submissions and HTTP 429 rate** rather than mislabeling the combined guest/merchant/station iteration count as guest orders. It also reports observed request p50/p95/p99; **outbox/worker backlog, source IP diversity and ERP host metrics require separate operator evidence**. Absent actual measurements are **pending**, not passed.

## Operator sign-off record — pending

| Acceptance gate                                                   | Exact run / timestamp / reviewer                                          | State    |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------- | -------- |
| Final PR-head PostgreSQL/Redis                                    | Add actual CI URL and SHA after checks                                    | Pending  |
| Final PR-head desktop and mobile browser                          | Attach SHA-locked synthetic evidence artifact                             | Pending  |
| Independent threat-model and tenancy audit                        | Named reviewer + dated findings                                           | Pending  |
| Real station device, sound denial and screen-reader               | Named operator + device and screenshots                                   | Pending  |
| Representative 25 owners / 50 outlets / 1k orders-hour mixed load | Actual sampled measurements, thresholds, ERP coexistence                  | Pending  |
| Off-host alert, backup and independent SQL+media recovery         | Verifiable operator receipt; restore separately deferred unless performed | Pending  |
| Deployed web+worker immutable SHA and migrations                  | Read deployed metadata; verify canary before operator approval            | Pending  |
| Paid kitchen commercial / statutory / fiscal rollout              | Separate product/legal approval, not authorized by this issue             | Excluded |

**Completion rule:** #76 stays OPEN until the source and operator evidence and independent acceptance are real. #77 rollout must not infer sign-off merely because #76's test PR merged. No tax, provider, production-data or release flags are activated by this work.
