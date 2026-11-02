# Plans, resource caps and Dedicated tier — proposal

**Status: proposal.** Direction approved by the owner in conversation on 2026-11-02; prices, caps and
the Dedicated design are hypotheses awaiting sign-off. Nothing here is implemented or deployed.
Today only two capabilities are gated (`ordering.new` ₹119, `kitchen.new` ₹299); the only hard
resource limit in code is `MAX_TABLES_PER_OUTLET = 200`. See
[razorpay-billing.md](operations/razorpay-billing.md), [admin-feature-access.md](admin-feature-access.md)
and [kitchen-pro-e-h-readiness.md](kitchen-pro-e-h-readiness.md).

## Principles

1. **Underpriced by design, protected by caps.** Low prices; every variable-cost resource (AI,
   media storage, devices) has a hard cap so a cheap plan cannot become a loss.
2. **Show everything, cap it.** Locked or capped features stay visible with a meter and an upgrade
   path. Visibility is a UI concern only; enforcement is in services.
3. **Free is a real product.** Menu, permanent QR, sold-out toggles and profile stay free. The
   printed QR link survives every downgrade (ADR 003).
4. **Never delete on downgrade.** Over-cap data is retained, hidden or read-only, and restored on upgrade.
5. **Never trust the client.** Limits come from server-resolved plan state, not request input.

## Plan matrix (hypotheses)

| Resource / feature (per outlet unless noted)        | Free            | Ordering        | Kitchen Pro                    | Dedicated         |
| --------------------------------------------------- | --------------- | --------------- | ------------------------------ | ----------------- |
| Price, INR / month (annual = 10 × monthly)          | 0               | 119             | 499 incl. 3 outlets, +149 each | Quote (see below) |
| Outlets per organization                            | 1               | 1               | 10                             | By contract       |
| Dishes                                              | 20              | 200             | 2,000                          | By contract       |
| Permanent QR codes / tables                         | 2               | 25              | 200 (existing code cap)        | By contract       |
| Staff seats (org)                                   | 2               | 5               | 25                             | By contract       |
| AI credits / month (pooled per org)                 | 10              | 150             | 1,000                          | Own key or pooled |
| Media storage                                       | 100 MB          | 300 MB          | 500 MB                         | By contract       |
| Accepting guest orders (QR → merchant inbox)        | Yes             | Yes             | Yes                            | Yes               |
| Table-based ordering, counter board, order tracking | Locked, visible | Yes             | Yes                            | Yes               |
| POS bill printing / receipts                        | Locked, visible | Yes             | Yes                            | Yes               |
| Reports history                                     | Locked, visible | 90 days         | 24 months + export             | By contract       |
| Kitchen Display System, stations, devices           | Locked, visible | Locked, visible | Yes (10 devices)               | Yes               |
| POS till / cash drawer shifts                       | Locked, visible | Locked, visible | Yes                            | Yes               |
| Multi-outlet reporting and shared menus             | n/a             | n/a             | Yes                            | Yes               |
| Intelligence / AI concierge suite                   | Locked, visible | Limited         | Full                           | Full              |
| Custom domain → public menu (redirect)              | Locked, visible | Locked, visible | 1 per outlet, max 10           | Own domain, full  |
| "Powered by MenuMinute" badge                       | Shown           | Shown           | Removable                      | Removable         |
| Support                                             | Docs            | Email           | Priority                       | Named contact     |

Notes:

- Free includes menu, sold-out controls, hours/profile, QR codes **and accepting guest orders**
  (owner decision, 2026-11-02). Free outlets receive orders in a basic merchant inbox; table
  ordering, the counter board, POS bill printing and reports are the Ordering upgrade. Because this
  moves the paywall, see [Free order intake](#free-order-intake) below.
- The badge is non-removable on Free and Ordering; only Kitchen Pro and Dedicated may remove it.
- Kitchen Pro as "A–Z" depends on the Kitchen Pro release gates. Until they pass, sell it as early
  access; do not advertise it as generally available.
- **Receipt printing is already separate from Kitchen Pro.** Checked 2026-11-02: the POS nav item
  has `gate: null` (`src/modules/dashboard/nav-model.ts`), and no POS migration or service calls
  `entitlement_allowed` for `kitchen.new`. So no decoupling change is needed. The consequence runs
  the other way: POS, the till and receipts are currently available to **every** outlet, so
  gating them behind Ordering (and the till behind Kitchen Pro) is a later, visible change. It is
  deliberately **not** part of slice 1, which changes no UI.

## Free order intake

Accepting orders on Free changes what `ordering.new` means today: it is currently the paid
capability that gates new accepted orders (see [admin-feature-access.md](admin-feature-access.md)).
Required consequences, to confirm before building:

- Introduce a distinct free intake allowance rather than granting `ordering.new` to everyone, so
  the paid grant still unlocks tables, the counter board, bill printing and reports.
- Cap Free intake to protect cost and support load. Owner-approved (2026-11-02): 100 accepted orders per month, shown
  as a meter, with accepted tickets always completable and a clear message when the cap is reached.
  The monthly window and reset rule are defined in slice 2b (see below).
- Free outlets need a minimal merchant inbox (accept, reject, mark ready), since the counter board
  is paid. Ordering launch safeguards (expiry, acceptance races, tenant scope) apply unchanged.
- Revenue impact: the ₹119 plan now sells operations tooling, not order intake. Expect a lower
  free-to-paid conversion unless the order cap and the paid tooling are compelling.

## Cap behavior

| Event                                   | Behavior                                                                                                                                                                                             |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create beyond a hard cap                | Rejected by the service with a typed `LIMIT_REACHED` error naming the resource, cap and next plan.                                                                                                   |
| Concurrent creates at the cap           | Count and insert in one transaction under an outlet-scoped lock, so two requests cannot both pass.                                                                                                   |
| 80% and 100% usage                      | Meters turn amber then red; one dismissible upgrade prompt per resource per week.                                                                                                                    |
| Downgrade or expiry with data above cap | 14-day grace, unchanged. After grace the owner's chosen N dishes stay published (default: oldest-created N); the rest are hidden, not deleted, and return on upgrade. Printed QR links keep working. |
| QR codes above the cap                  | The first N by creation stay active; the rest show a "not available" page, not an error, and reactivate on upgrade.                                                                                  |
| AI credits exhausted                    | Manual path only, no overage billing in v1. Credits reset monthly; no rollover.                                                                                                                      |
| Accepted orders after plan loss         | Unchanged rule: accepted tickets finish. New orders continue only within the Free intake allowance.                                                                                                  |
| Abuse (pay, bulk-add, downgrade)        | The grace window and hide-not-delete rule leave nothing extra live on Free.                                                                                                                          |

## Implementation shape

- **Plan catalog in code:** `src/modules/plans/` holds a pure `resolveLimits(plan)`; limits are
  constants reviewed in PRs, like the billing catalog.
- **Effective plan:** derived server-side from active entitlement grants (the highest active plan
  wins; none means Free). Pro implies Ordering. Add capability keys instead of boolean flags.
- **Overrides:** a small audited `org_limit_overrides` table (operator-written with step-up, like
  grants) for sales exceptions. It never lowers a cap below current paid entitlement.
- **Usage counters:** derive counts from source tables inside the guarded transaction; use a
  counter table only if profiling shows count queries are slow.
- **Billing:** two Razorpay plans plus an extra-outlet add-on. Plan change needs proration and
  provider behavior verified in the sandbox before launch; changing amounts needs a reviewed
  provider-plan migration. Existing open items (invoice/GST, self-service cancel, renewal
  reconciliation) remain launch gates.
- **UI:** one shared `<UsageMeter>` and `<LockedFeature>` component driven by a server-provided
  plan snapshot; no client-side limit logic.

## Kitchen Pro: what remains before it can be the maximum paid tier

Source: [kitchen-pro-e-h-readiness.md](kitchen-pro-e-h-readiness.md) and
[kitchen-pro-activation-a-h.md](kitchen-pro-activation-a-h.md). Those documents describe the
state of the work when they were written; re-check the linked issues #76 and #77 for anything
closed since. Per them, the remaining items are **evidence, review, operations and commercial
gates**, not missing code for phases A–H:

| Remaining item                                                                                                   | Type                   |
| ---------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Independent review (security, correctness, operations, UX/accessibility) by a reviewer other than the code owner | Review                 |
| Final-SHA native ARM64 CI (four lanes plus quality gate) and migration compatibility on that SHA                 | CI evidence            |
| Load run (`infra/load/kitchen.js`) on a disposable dataset, with owner-approved resource and SLO limits          | Capacity evidence      |
| Failure injection: Redis cache and queue loss, web/worker restart, revoked sessions, duplicate commands          | Reliability evidence   |
| Shared-ERP coexistence measurements before, during and after load                                                | Operator evidence      |
| Fresh off-host backup and an isolated SQL plus private-media restore                                             | Operator evidence      |
| Off-host backup timer and non-destructive alert test                                                             | Operator evidence      |
| Exact release identity (web and worker symlinks, source CI, public SHA agree)                                    | Operator evidence      |
| Controlled live pilot on an approved disposable outlet (two-operator approval, seven-day grant)                  | Owner approval         |
| Commercial activation: owner-approved pricing, supported jurisdictions and tax, SLO, incident owner              | Product and commercial |
| Billing path: a Kitchen Pro plan is not published, there is no checkout or self-enablement today                 | Engineering            |

Engineering work this plan adds on top: decouple receipt printing from the Kitchen Pro capability,
fold multi-outlet and custom domains into the Pro plan, and add the plan/limit layer. Until the
gates above are signed, Kitchen Pro is sold only through the existing seven-day pilot and operator
grants, and the pricing page must not describe it as generally available.

## Custom domain → public menu (Kitchen Pro)

Scope is a redirect/alias to the existing public menu, not a separate app.

- **Ownership proof:** the owner adds a domain, we show a DNS TXT token plus a CNAME target; the
  worker verifies it. Domains are unique platform-wide and tied to one outlet.
- **TLS:** per-domain certificates (ACME) on the edge. On the shared ERP host this requires a
  reviewed Nginx coexistence plan; do not edit the ERP vhost or certificates. If the shared host is
  not acceptable, front custom domains with a separate edge (for example a small ARM VM or a CDN
  with custom hostnames) that proxies to the app.
- **Routing:** resolve `Host` to an outlet via a verified-domain table; unknown hosts get a 404, never
  a default tenant. Canonical URL and QR tokens are unchanged.
- **Safety:** reject apex-takeover patterns, IPs, reserved/own domains and unverified or lapsed
  domains; re-verify periodically; lapse on downgrade.

## Dedicated tier

"An app dedicated to them, on their domain." Two very different products hide in that sentence;
decide which to sell.

| Option                        | What it is                                                                                 | Cost / risk                                              | Fit                                 |
| ----------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- | ----------------------------------- |
| **A. Branded (shared infra)** | Own domain, own brand, name, colors and logo; still the shared multi-tenant platform.      | Low. Reuses the custom-domain work.                      | Most "I want my own app" requests.  |
| **B. Isolated instance**      | Separate stack: own database, workers and Redis on a separate ARM64 host, on their domain. | High: infra, backups, upgrades and on-call per customer. | Chains, compliance, data residency. |

Recommendation: ship **A first as the Dedicated entry level**, and offer **B only by contract**.

- **Do not host B on the shared Oracle ERP server.** It has 4 cores and 23 GiB and is audited for
  one coexistence deployment (see [server-inventory.md](server-inventory.md)). Each B customer gets
  its own host.
- **Reuse the deployment model:** the existing edition mechanism (`app_private.deployment_edition`,
  owner-controlled, never web-writable) is the precedent. A `dedicated` edition would be a
  separate, reviewed migration; it must not weaken tenant isolation or the Community single-user
  rule.
- **Release path:** same verified ARM64 artifact and migration helper, customer-specific env and
  backup target. Never a forked codebase.
- **Pricing:** one-time setup plus monthly, covering host, backups, monitoring and a support-hours
  allowance, with a floor set by real cost (infra + ops hours + margin). Do not publish a price
  until the cost is measured. Placeholder to test: setup from ₹25,000, monthly from ₹9,999 for A
  with brand and domain, and quote-only for B.
- **Contract terms:** SLA, data export on exit, backup/restore evidence, and an offboarding path.

## Free-to-paid conversion hooks

- Meters on dishes (n/20), QR codes (n/2) and AI credits, visible on the dashboard.
- A "Preview ordering" mode on Free using the demo-safe flow, ending with an upgrade call to action.
- Auto-trial of Ordering on first publish and QR download (see the earlier strategy): 14 days,
  once per organization, then a 7-day grace before dropping to Free.
- Annual plan at 10 × monthly, and the founding-member price lock for the first N outlets.

## Open decisions

1. Whether Free gets a basic merchant inbox (the 100 orders a month cap is approved).
2. Final prices and caps (this doc is a starting point; pick numbers you can afford to honor).
3. When to gate POS, the till and receipts by plan, given they are ungated today (a visible change).
4. Dedicated: A only, or A plus B-by-contract?
5. Custom-domain edge: shared Nginx or a separate edge?
6. International billing (USD): Razorpay is INR-only here; choose a provider or merchant of record.
7. Whether Ordering gets limited intelligence features or none.

## Delivery slices

| #   | Slice                                                                                                                                                                                                                                | Depends on                |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- |
| 1   | Plan catalog, `resolveLimits`, `LIMIT_REACHED` error, tests (done; no UI, no enforcement)                                                                                                                                            | This sign-off             |
| 2   | Enforce dish and QR caps in services (transactional); done behind `PLAN_LIMITS_ENFORCED` (default off), no UI                                                                                                                        | 1                         |
| 2b  | Free order intake: 100 accepted orders per month. Needs a reviewed SQL migration to the guest-order functions, a monthly counter and a basic merchant inbox; changes what the public menu offers, so it needs its own release review | 2                         |
| 2c  | Usage meters and locked-feature UI (the only UI work; requires explicit sign-off)                                                                                                                                                    | 2                         |
| 3   | Downgrade/grace behavior (hide, not delete), restore on upgrade                                                                                                                                                                      | 2                         |
| 4   | AI credit accounting per org per month                                                                                                                                                                                               | 1, AI spend accounting    |
| 5   | Self-serve billing, proration, GST invoices, auto-trial                                                                                                                                                                              | Billing gates             |
| 6   | Kitchen Pro as the max plan; multi-outlet caps                                                                                                                                                                                       | Kitchen Pro release gates |
| 7   | Custom domain verification, routing, TLS                                                                                                                                                                                             | Edge decision             |
| 8   | Dedicated A (brand), then B by contract                                                                                                                                                                                              | 7, pricing                |

Each slice is one PR with an explicit migration and rollback note, tested against real PostgreSQL.

## Slice 2 as built

- Enforcement lives in `src/modules/plans/{guard,store}.ts` and wraps the three writers that can
  add dishes or QR codes: `commandMenu` (create, save, assign, restore), `applyReview` (menu
  import) and `qrCommand` (create, regenerate). The SQL commands are unchanged.
- **Transactional:** an outlet-scoped advisory lock is taken, the count is read, the command runs,
  the count is read again, and growth beyond the cap throws `LIMIT_REACHED`, rolling the whole
  transaction back. Concurrent writers for one outlet are serialized.
- **Grandfathering:** only growth past the cap is rejected. An outlet already over its cap can edit,
  shrink and reorder; nothing is deleted. Hiding extra dishes after a downgrade is slice 3.
- **Dish count:** distinct dish ids across non-archived menus an outlet owns or is assigned.
  **QR count:** active QR codes. Both are counted with the acting user's database visibility.
- **Plan source:** `ordering.new` and `kitchen.new` entitlements, as before. Community Edition is
  never capped.
- **Off by default:** `PLAN_LIMITS_ENFORCED=false`. Enabling it is an operator step after the
  existing-data review: list outlets over their cap first, because they will be unable to add more.
- Not in this slice: the Free order cap, usage meters or any UI, AI credits, media bytes, seats,
  outlets and custom domains.

## Pre-enable audit: outlets over their cap

Run this **before** setting `PLAN_LIMITS_ENFORCED=true`. It is read-only (one `READ ONLY`
transaction, rolled back), uses the isolated migration-owner URL like other operator scripts, and
prints outlet and organization ids and counts only: no emails, names, prices or credentials.

```bash
MIGRATION_DATABASE_URL=... pnpm exec tsx scripts/plan-cap-audit.ts
MIGRATION_DATABASE_URL=... pnpm exec tsx scripts/plan-cap-audit.ts --json
```

It reports outlets per plan, how many are strictly over a cap, how many are at or over (those can
add nothing more), and each over-cap outlet with `dishes=n/cap` and `qr=n/cap`, worst first. It uses
the same counting rules as the write guard, but the migration owner bypasses row-level security,
so its totals are authoritative rather than one staff member's view.

How to act on the result:

- **At or just under a cap:** nothing breaks; they hit `LIMIT_REACHED` on their next add.
- **Over a cap:** they keep everything and can edit or shrink, but cannot add. Decide per outlet
  whether to contact the owner, grant an Ordering trial, or wait for slice 3 (hide, not delete).
- **Demo outlet:** it holds the Kitchen Pro grant, so its 236 dishes are under the 2,000 cap.
- Record the date, commit SHA and the aggregate counts in the release evidence; do not paste
  per-customer lists into issues.

The audit has not yet been run against production; this PR cannot access production data.
