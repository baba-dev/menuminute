# Development contract

Read this file before changing the repository. The working repository name is MenuMinute;
the product planning context is Food Minutes. Do not rename the product incidentally.

## Source of truth

- Read `docs/architecture.md`, `docs/domain-invariants.md`, and the relevant domain guide.
- For any production, release, monitoring or migration work, read `docs/production-runbook.md` first;
  `docs/deployment-actions.md` records previous deployments and `docs/automatic-migration-deployment.md`
  defines the successor v4 unattended migration/backup contract.
  Recorded live host state takes precedence over older proposed layouts or local CI defaults.
- `docs/decisions.md` records approved target decisions; code may still implement the old scaffold.
- Read `docs/product-requirements.md` for approved hierarchy, roles, fulfillment, currencies and expiry.
  USD/INR restrict platform subscription billing only; outlet transactions use supported local currencies.
- `docs/implementation-plan.md` separates existing behavior from future acceptance gates.
- Phase 4: read `docs/orchestration/phase-4.md`, `docs/orchestration/phase-4-acceptance.md`,
  and `docs/orchestration/phase-4-ops-evidence.md`. A merged PR or successful CI does not
  close operator-backed host, restored SQL+private media, off-host alerts or ERP coexistence gates.
- Production targets **Linux ARM64/aarch64**, Ubuntu 24.04.4 LTS on the shared Oracle ERP
  server: 4 visible ARM cores, 23 GiB RAM, 72 GB root filesystem. See
  `docs/server-inventory.md` for the dated audit, constraints and outstanding launch inputs.
  Initial live deployment was verified on 2026-10-16; do not infer the deployed SHA from current main.
- Build/test native dependencies on Linux ARM64; never deploy AMD64 node_modules or artifacts.
  Do not use `/usr/bin/node` for production MenuMinute: isolated `/opt/menuminute/node24/bin/node`
  is required, preserving ERP's Node 20. Live media is local at `/var/lib/menuminute/media`;
  Cloudflare R2 is encrypted backup storage, not the live media origin.
  Protect the existing ERP; infrastructure changes require a reviewed coexistence/rollback plan.

## Required boundaries

- Keep Next.js route handlers and Server Actions thin; enforce authorization in services.
- Target PostgreSQL + Drizzle/pg, BullMQ and two Redis workloads from the starter.
- PostgreSQL owns durable business state. Redis is not an order ledger or authorization authority.
- Check current membership and outlet scope; never infer a private tenant from a demo/default.
- Database transactions must atomically persist business changes and outbox intent.
- Use idempotent consumers and durable reconciliation; do not claim exactly-once delivery.
- Validate all untrusted API, job and AI inputs. Never trust client prices or entitlements.
- Keep AI/media processing off the ordering request path. No autonomous AI publishing.
- Never invent ingredients, allergen safety or dietary claims.

## Implementation workflow

1. Inspect the actual files, tests, environment schema and lockfile; record baseline failures.
2. State the affected invariant, intended behavior, failure behavior and acceptance evidence.
3. Implement one complete slice with explicit migration and rollback considerations.
4. Select compatible stable dependency versions and pin reproducibly. Review package provenance,
   maintenance, license and native Linux ARM64 support; do not blindly install latest versions.
5. Test changed invariants against real PostgreSQL/Redis when that infrastructure lands.
6. Update current-status documentation when behavior changes; distinguish implemented from planned.
7. Report exact commands, results and limitations. Never describe docs as deployed infrastructure.

## Verification

- Documentation-only: formatting for changed Markdown, relative links and `git diff --check`.
- Runtime: lint, typecheck, relevant tests and production build; execute end-to-end tests for
  affected workflows. Follow `docs/testing-strategy.md` for migration and ordering gates.
- Use frozen-lockfile installs. Do not regenerate migrations merely to start the app.
- No `db:push` against production, production demo seed, secret logging or destructive migrations.
- Don't weaken checks to hide failures. Keep unrelated fixes separate and report baseline issues.
- Never request or print production credentials in commits, fixtures, logs or PR descriptions.
- Public browsing and local tests must not trigger paid providers or production order submissions.

## Production change ownership

- A PR merge is **not by itself** a deployment. Final native ARM64 CI on the latest SHA (all four lanes and aggregate gate), artifact
  digest, the configured production environment gate, ERP/readiness checks and migration
  compatibility are required. With the one-time root-installed helper v4, the approved continuous
  path accepts append-only checksummed SQL migrations after a newly verified encrypted off-host
  backup, without per-SHA approval; missing prerequisites or failed SQL stop deployment.
- Deploy **only** the reviewed full 40-character SHA, with consistent `current` and `worker-current`
  symlinks; worker and web must share exact storage configuration. Existing manually installed release
  must not be overwritten by optional Actions staging helper or misidentified as helper-staged.
- Never edit ERP `/var/www/bababuilds-erp`, root PM2, port 3000, `/usr/bin/node`, Nginx ERP
  vhost/certificate, or shared firewall as a side effect. Capture ERP HTTP 200 before/after changes.
- Never print or paste `/etc/menuminute/*.env`, R2 credentials, keys or restic password. Document
  outstanding live merchant media and backup/alert verification honestly. Automatic SQL execution
  uses the isolated migration owner, never web/worker credentials or GitHub-hosted DB secrets.

## Delivery

Use small reviewable PRs. Include behavior, migration requirements, evidence and risks.
A documentation approval is not proof that implementation gates passed. Merging and production
release follow the task's authorization and the acceptance gates; do not deploy unfinished slices.

## Development orchestration

Read `docs/orchestration/README.md` before taking implementation work. Use a linked work-package
issue with one named implementer, explicit dependencies and reserved write paths. Shared schema,
lockfile, auth, layout and CI changes have one writer at a time. Publish producer contracts before
parallel consumers; use isolated checkouts and supply the completion handoff. Logical lane ownership
does not replace service authorization or independent review. See the orchestration ownership map,
architecture contracts and delivery process for exact rules.

## Continuous delivery invariants

PRs may test packaging but cannot publish, receive production secrets, or activate.
The main publisher consumes the exact verified CI artifact and records the source
CI run ID and full SHA in the handoff; never trust the downstream
`workflow_run.head_sha` as the source identity. Staging uses the
`production-staging` environment and is **not** a live deployment. Only an
eligible activation job uses the `production` environment and advertises
https://food.bababuilds.com. Unattended schema deployment requires reviewed helper v4 installed
root-owned, append-only historical migration validation, a fresh verified off-host backup
before new SQL, and the latest main SHA immediately before cutover. The helper must verify both service users, source archive and paired
runtime identities. Public-readiness release identity must equal the candidate
SHA. A failed public check may restore only a verified schema-compatible
application release, never SQL or customer data. Preserve GitHub Environment
protections; a configured required reviewer remains an explicit operator gate.
