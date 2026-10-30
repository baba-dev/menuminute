# Ember Intelligence 2.0 — Epic #152, PR #227

Status: source implementation in review; not an inference entitlement, deployment or operator activation.

## Phase A — authority and constraints

Existing PRs #155/#158/#160/#188/#195/#216 remain the provider, transaction and authorization contract.
No migration or arbitrary model-generated SQL/HTTP/command/action tool. This PR does not weaken
origin verification, business transitions, actor/outlet authorization, RLS, idempotency, limits,
model entitlement or the existing release pipeline. Master and assistant flags remain optional and off by default.

## Phase B — bounded merchant facts

Read-only tools expand to `reports.summary`, `menu.findDish`, `imports.pulse` and `qr.pulse`.
All four reuse existing outlet-scoped domain projections and never expose contact details,
raw PDFs, menu import source documents or internal QR tokens. Menu search uses committed
published releases and outlet-specific overrides, not private drafts. Reports reuse
Reports & Insights' timezone-aware range and restaurant-local **calendar week**, not UTC
or the local browser clock. The visible order-value number is **submitted order value**;
staff attestation, refund and bank/provider verification are separate classifications.
Import and QR tools provide bounded states and counts, not autonomous workflows.

The provider adapter supports up to eight exposed tools per request; `selectQuestionTools`
chooses a bounded subset of currently permitted tools and prioritizes a matching domain.
A tool is still checked again against live SQL permission at invocation. Prompt text never
becomes a SQL command or arbitrary URL.

## Phase C — human-controlled operational actions

Ember can recognize narrowly phrased **human-authored** dish availability requests,
open the existing restricted availability composer and preselect a dish only if exactly
one presently authorized published item matches. An ambiguous request leaves the dish
unselected. Neither the model nor its prose can create, confirm or apply a mutation.
The separate SQL proposal still requires current `menu.write`, revision guard, expiry,
confirmation/acknowledgement and idempotent domain command. Bulk/sensitive writes remain forbidden.

## Phase D — accessible presentation

Safe Markdown subset only: no model-authored active links, images, scripts or HTML.
Tables scroll horizontally, historical function JSON is hidden and source labels avoid
implementation names. The mobile launcher lives in the workspace header or Kitchen Pro
page flow and cannot occlude fixed bottom-page controls. Existing keyboard trap,
reduced-motion and durable history/reconnect behavior remain.

## Phase E — asynchronous and import workflow boundary

Import review/status is discoverable through the read-only tool and allowlisted first-party
Menu Import link. All actual source capture/review/apply continues through the established
private menu-import APIs and worker infrastructure; Ember initiates **no** import jobs,
AI enrichment, publication or writes. Durable background orchestration remains a separate
unimplemented extension. This boundary is intentional pending job review, provenance and quota design.

## Phase F — security, privacy and spend

- Retain existing per-user daily turn caps, per-organization 80-attempt cap, two-round
  maximum, durable attempt reservation, 30-second provider timeout, 256 KB fixed-endpoint
  response bound and no blind retries or cross-provider paid fallback.
- Safe deterministic answers avoid a second inference request for validated, narrow
  menu and reports questions. Unknown or partial evidence never becomes a fabricated sale,
  ingredient, allergy claim or dish.
- Not yet approved for commercial production: **real provider-specific per-token pricing,
  organization monetary ceilings, retention/deletion service, consent/data-processing review**.
  Raw prompt/evidence history currently persists; obtain a reviewed retention design
  and independent redaction/security review **before activating commercial assistants**.
- Never enable `AI_ASSISTANT_ACTIONS_ENABLED` solely because read-only inference works.

## Phase G — validation matrix

Run format + ESLint, TypeScript, targeted Vitest, real PostgreSQL/Redis integration,
isolated Ember-enabled Playwright, native ARM64 production build, security/secret scans,
and exact-final-SHA aggregate on the final candidate. Verify 360px/390px/table scrolling,
keyboard focus, theme and reduced motion; tenant isolation, revocation, current published
menus, stale proposals, 0/2/3-decimal currencies and timezone/DST transitions.
Fake providers only in CI; never live billable requests.

## Phase H — guarded release and operator acceptance

A merged PR does not enable inference or deploy a paid provider. Before rollout:

1. Record immutable reviewed commit SHA, exact deployed web/worker SHA, CI pass, migrations
   (if any), private media backup and ERP health before/after.
2. Approve NVIDIA/Cloudflare commercial entitlement for **exact model IDs**, live tool-name
   compatibility and provider pricing. Review privacy, retention and customer consent.
3. Record a **monetary** upper bound and operator intervention plan; attempt count alone
   cannot establish spend. Provision scoped secrets without logging them.
4. Enable read-only capabilities for a controlled merchant canary. Exercise live
   `Do I sell Chole Bhature?`, `How much sale this week?`, outages and reconnect.
   Inspect authorized source, period, currency and data correctness without publishing.
5. Keep action gate disabled until independently reviewed; verify role revocation, stale
   revision, replay and precise confirmed result in a separately authorized pilot.
6. Confirm rollback of feature flags leaves POS, Orders, Kitchen and public menus healthy.

### Remaining epic gaps

Broad conversational follow-ups, export, long-running autonomous assistant workflows,
provider-cost ledger, deletion/retention operator, and independent production/financial
acceptance remain OPEN. Do not close #152 on the strength of this PR alone.
