# Plans, resource caps and Dedicated tier — proposal

**Status: proposal.** Direction approved by the owner in conversation on 2026-11-02; prices, caps and
the Dedicated design are hypotheses awaiting sign-off. Nothing here is implemented or deployed.
Today only two capabilities are gated (`ordering.new` ₹119, `kitchen.new` ₹499); the only hard
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

## Plan matrix

The price, outlet, dish and QR rows below are **owner-approved final (2026-11-02)**; the remaining rows are
the working plan. Where the table says "Virtually unlimited", the code has no cap (`null`).

| Resource / feature (per outlet unless noted)        | Free            | Ordering        | Kitchen Pro                | Dedicated           |
| --------------------------------------------------- | --------------- | --------------- | -------------------------- | ------------------- |
| Price, INR / month                                  | 0               | 119             | 499 flat, up to 10 outlets | 30,000              |
| Outlets per organization                            | 1               | 1               | 10                         | Virtually unlimited |
| Dishes                                              | 20              | 200             | 2,000                      | Virtually unlimited |
| Permanent QR codes                                  | 2               | 25              | 200 (existing code cap)    | Virtually unlimited |
| Dining-floor tables (numbered)                      | 2               | 10              | 20                         | Unlimited           |
| Dining-floor chairs                                 | 6               | 30              | 60                         | Unlimited           |
| Staff seats (org)                                   | 2               | 5               | 25                         | By contract         |
| AI credits / month (pooled per org)                 | 10              | 150             | 1,000                      | Own key or pooled   |
| Media storage                                       | 100 MB          | 300 MB          | 500 MB                     | By contract         |
| Accepting guest orders (QR → merchant inbox)        | Yes             | Yes             | Yes                        | Yes                 |
| Table-based ordering, counter board, order tracking | Locked, visible | Yes             | Yes                        | Yes                 |
| POS bill printing / receipts                        | Locked, visible | Yes             | Yes                        | Yes                 |
| Reports history                                     | Locked, visible | 90 days         | 24 months + export         | By contract         |
| Kitchen Display System, stations, devices           | Locked, visible | Locked, visible | Yes (10 devices)           | Yes                 |
| POS till / cash drawer shifts                       | Locked, visible | Locked, visible | Yes                        | Yes                 |
| Multi-outlet reporting and shared menus             | n/a             | n/a             | Yes                        | Yes                 |
| Intelligence / AI concierge suite                   | Locked, visible | Limited         | Full                       | Full                |
| Custom domain → public menu (redirect)              | Locked, visible | Locked, visible | 1 per outlet, max 10       | Own domain, full    |
| "Powered by MenuMinute" badge                       | Shown           | Shown           | Removable                  | Removable           |
| Support                                             | Docs            | Email           | Priority                   | Named contact       |

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

| Event                                     | Behavior                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Create beyond a hard cap                  | Rejected by the service with a typed `LIMIT_REACHED` error naming the resource, cap and next plan.                                                      |
| Concurrent creates at the cap             | Count and insert in one transaction under an outlet-scoped lock, so two requests cannot both pass.                                                      |
| 80% and 100% usage                        | Meters turn amber then red; one dismissible upgrade prompt per resource per week.                                                                       |
| Downgrade or expiry with dishes above cap | 14-day grace, then dishes beyond the cap (in menu order) are hidden from guests, not deleted, and return the moment the plan allows. See Slice 3 below. |
| QR codes, tables and chairs above the cap | Never switched off. They keep working (printed QR links must survive every downgrade); only adding more is blocked.                                     |
| AI credits exhausted                      | Manual path only, no overage billing in v1. Credits reset monthly; no rollover.                                                                         |
| Accepted orders after plan loss           | Unchanged rule: accepted tickets finish. New orders continue only within the Free intake allowance.                                                     |
| Abuse (pay, bulk-add, downgrade)          | The grace window and hide-not-delete rule leave nothing extra live on Free.                                                                             |

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

| #   | Slice                                                                                                                                                       | Depends on                |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| 1   | Plan catalog, `resolveLimits`, `LIMIT_REACHED` error, tests (done; no UI, no enforcement)                                                                   | This sign-off             |
| 2   | Enforce dish and QR caps in services (transactional); done behind `PLAN_LIMITS_ENFORCED` (default on since 0086), no UI                                     | 1                         |
| 2b  | Free order intake, 100 guest orders a month; done in migration 0079 behind an owner-only database switch (default OFF)                                      | 2                         |
| 2c  | Usage meters and plan panel (UI); done, hidden until `PLAN_LIMITS_ENFORCED=true`                                                                            | 2                         |
| 3   | Downgrade grace and hiding of extra dishes (hide, not delete), instant restore on upgrade; done in migration 0081 behind an owner-only switch (default OFF) | 2                         |
| 4   | AI credit accounting per org per month; done in migration 0088 (see "AI credits and photo storage")                                                         | 1, AI spend accounting    |
| 5   | Self-serve billing, proration, GST invoices, auto-trial                                                                                                     | Billing gates             |
| 6   | Kitchen Pro as the max plan; multi-outlet caps                                                                                                              | Kitchen Pro release gates |
| 7   | Custom domain verification, routing, TLS                                                                                                                    | Edge decision             |
| 8   | Dedicated A (brand), then B by contract                                                                                                                     | 7, pricing                |

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
- **On by default (since migration 0086):** `PLAN_LIMITS_ENFORCED` is true unless set to `false`. The
  product has not launched, so there is no existing data to review; the cap audit below remains for any
  later change to the limits.
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

## Slice 2b as built: Free order intake

Migration `0079_free_order_intake.sql` (forward-only). It changes nothing until the switch is turned on.

- **Switch:** `app_private.plan_settings` (one row, owner-only; no application role can read or write
  it): `free_intake_enabled` (default `false`) and `free_intake_monthly_cap` (default `100`, matching
  `PLAN_LIMITS.free.ordersPerMonth`; a test asserts they agree).
- **What the switch does:** an outlet **without** a paid `ordering.new` grant may accept guest orders
  while it is under the cap. Paid outlets are never limited. Changes are limited to
  `submit_guest_order` (copied from migration 0020 with only the entitlement check replaced and one
  variable added), `public_ordering_enabled`, and one new dashboard capability function. Seven new
  tests run against real PostgreSQL, and the full suite passes (206 files).
- **What counts:** guest-menu orders (`intake_source='guest_menu'`) in the current calendar month in
  the **outlet's timezone**, excluding rejected, cancelled and expired. Staff and POS sales never
  consume the cap, and a rejected order frees capacity.
- **Concurrency:** a per-outlet advisory lock serializes the count and insert, so simultaneous
  guests cannot overshoot (tested: 6 parallel submissions against a cap of 2 admit exactly 2).
  A retried submission of an already-accepted order stays idempotent at the cap.
- **Diner experience:** at the cap, checkout is rejected with "This restaurant is not taking new
  online orders right now." The QR menu keeps working. The public page reads `orderingEnabled` from
  the 180-second menu cache (the same lag a revoked paid grant has today), so the cart can stay
  visible for up to three minutes after the cap is reached; the server still rejects immediately.
- **Merchant experience:** while the switch is on, members of a Free organization see the existing
  Orders workspace (accept, reject, advance) because the dashboard `ordering` capability follows
  `orders_workspace_allowed`. It stays available at the cap so existing orders can be finished.
  Today that workspace is the whole Orders board; splitting a basic inbox from the paid counter
  board is slice 2c (UI). Kitchen Pro and its gates are unaffected.
- **Not changed:** billing screens still show "no active grant" for Free (they read the real paid
  grant), and the public pricing page copy still says ordering is paid. Update that copy in the
  same release that enables the switch.

### Enabling and rolling back (operator, migration-owner connection only)

Do this only after the cap audit above, the Phase 4 and ordering release gates for your deployment,
and a fresh verified backup. Enabling exposes order intake on every published Free outlet.

```sql
-- enable
UPDATE app_private.plan_settings SET free_intake_enabled = true;
-- optional: change the cap
UPDATE app_private.plan_settings SET free_intake_monthly_cap = 100;
-- roll back (instant, no data change; paid ordering is untouched)
UPDATE app_private.plan_settings SET free_intake_enabled = false;
```

Rolling back the switch does not delete orders, and the order APIs do not check it after
submission. But the Orders link disappears from the dashboard of Free organizations again, so
finish or reject their pending and accepted orders **before** turning the switch off. The migration
itself is not reversed; use a new forward migration if it ever needs removing.

## Slice 2c as built: usage meters and plan panel

Nothing is visible until `PLAN_LIMITS_ENFORCED=true`; with the default (off) every page renders
exactly as before. Migration `0080_plan_usage_snapshot.sql` adds one read-only function so the
dashboard can see the Free order count without reading the owner-only settings table.

| Where                                | What the owner sees                                                                          |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| Menu Studio, under the hero          | A slim strip: **Dishes n / cap**                                                             |
| QR Studio, under the inventory cards | A slim strip: **QR codes n / cap**, updating live as codes are created or revoked            |
| Organization → Billing entitlements  | A **Plan & usage** panel: every meter plus what the plan includes, limits and what is locked |

Design and accessibility decisions:

- **Honest by construction.** Only limits that are really enforced get a meter: dishes, QR codes,
  tables, chairs, outlets, AI credits, photo storage and, while Free intake is on, orders this month.
  Seats and custom domains have no meter until something enforces them. Features show as locked only when they truly are
  (online ordering without intake, and the Kitchen display). POS, reports and similar are not
  gated today, so they are not shown as locked.
- **State is never colour alone.** Each meter has an accessible `role="meter"` with spoken text
  ("17 of 20 dishes used") and a visible status chip: "3 left", "Limit reached" or "2 over the
  limit", with an icon from 80% upward. Bars cap at full for assistive tech; the text tells the truth
  for outlets already over a cap.
- **Calm until it matters.** Below 80% the strip is quiet and links to "Plans & usage". From 80%
  the bar turns ember, at the cap it turns red, and a hint says what the next plan allows (for
  example "Ordering allows 200"). No prices appear anywhere in this UI; pricing stays in the
  existing billing buttons and on the pricing page.
- **Ink & Ember tokens only.** Built on the shared `--paper`, `--ink`, `--panel`, `--ember`,
  `--success`, `--danger` and `--gradient` tokens, so Light and Dark are automatic; the strip is
  translucent so it takes the warm tone of the studio page. Bars animate only when the user has
  not asked for reduced motion; touch targets are at least 44px on phones; numbers use a fixed
  locale (no hydration mismatch) and tabular figures.
- **Never breaks a page.** The reader returns nothing on any error, for non-members, for contract
  and Community plans, and when enforcement is off.

Verification: unit tests for the view model, jsdom component tests for accessibility and the
render-nothing cases, real-PostgreSQL tests for the reader and the snapshot function's access rule,
the full suite (209 files), and manual visual review of Free (comfortable, near, at and over the
cap), Ordering and Kitchen Pro in Light and Dark at desktop and 390px widths, with no horizontal
overflow. The Playwright end-to-end suite was not run for this slice.

Known limits: the Menu Studio strip reflects the server count at load and refreshes after saves
(the studio already refreshes the page on save); dish counts use the acting user's visibility;
the "Compare plans" link goes to the public pricing page, whose copy is not yet updated for the new
plans.

## Dining-floor quotas (added 2026-11-02)

Owner-approved: **Free 2 tables / 6 chairs, Ordering 10 / 30, Kitchen Pro 20 / 60, Dedicated unlimited.**

- **What counts:** active, numbered floor tables (legacy QR-only tables have no floor number and never
  count) and active chairs, including chairs not yet assigned to a table.
- **Enforcement:** the same transactional guard as dishes and QR codes, around the only two writers,
  `createTable` (a table with its first chairs, all or nothing) and `addChairs`. A table whose chairs
  would push the outlet over its chair cap is rejected as a whole. The older 200-table ceiling in the
  floor service remains as a technical limit. Off until `PLAN_LIMITS_ENFORCED=true`.
- **Grandfathering:** an outlet already over a cap can keep operating and shrink, but not grow.
  Nothing is deleted or hidden (hiding extras after a downgrade is slice 3).
- **Visibility:** meters on the Dining floor page, the Plan & usage panel, `/billing` and the
  dashboard widget; the plan comparison shows tables and chairs as a single "Dining floor" row.
- **Audit:** `scripts/plan-cap-audit.ts` now reports tables and chairs too. Run it before enabling.

## Plan widget and /billing

**Dashboard widget ("Plan & billing")** is a normal dashboard widget (the eighth), so owners can hide,
pin and reorder it in "Customize layout". It sits under the dining floor beside Today's pulse: the
pulse now spans two grid rows so the two stack evenly. The marketing homepage's dashboard replica
shows it with sample data (a test keeps the replica in step with the real widget list). It is a
bento of three tiles: your plan and price, your two most-used meters, and what the next plan
unlocks with a single call to action. Owners get "Upgrade to Ordering" or "Upgrade to Kitchen Pro", both
straight into checkout; non-owners are told to ask the owner; while payments are off it says "See plans".

**`/billing`** is the main billing page, reachable from the widget, every usage strip and the
Organization panel. It adds no new payment path: upgrades use the existing checkout API
(`POST /api/organizations/{id}/billing/checkout`), the existing provider webhooks mint the paid
entitlement, and cancellation uses the existing cancel API. After the payment is authorized the
page refreshes every 4 seconds (up to 10 times) until the new plan appears.

| Section             | Shows                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------ |
| Your plan           | Plan, catalog price, what it includes                                                            |
| Billing cycle       | Renewal or end date from the subscription, or the granted access window; payment note            |
| Usage & limits      | Every enforced meter with what the next plan allows                                              |
| Unlock next         | Benefit-by-benefit before and after, plus the one action                                         |
| Choose your plan    | Free, Ordering and Kitchen Pro, each with a truthful state (current, included, upgrade, why not) |
| Subscriptions       | Provider subscriptions with owner-only "Cancel renewal" (confirm step)                           |
| Payments & invoices | Plain statement that the provider handles payment; GST invoices marked "not available yet"       |
| Access history      | Recent grant windows and their status                                                            |

Honesty rules: prices are the reviewed catalog amounts only (`PAID_PLAN_CATALOG`; today Ordering
INR 119, Kitchen Pro INR 499, the final owner-approved prices). Kitchen Pro is sold like Ordering
inside Billing: its card has an "Upgrade to Kitchen Pro" button that opens the same checkout. On the
public pricing page, Kitchen Pro shows "Request early access" until Kitchen checkout is open (see
[commercial availability](commercial-availability.md)). The server remains the
authority: while the platform's Kitchen release flag (`kitchenCommerceEnabled`) is off, the card
shows "Kitchen Pro checkout is not available on this deployment yet." instead of a button. Payment
methods and invoices are not shown because the application does not hold them. A billing load
failure says so instead of guessing. Non-owners get a read-only overview with the reason on every
locked action.

Not done: a sidebar entry for Billing (the navigation model is tightly tested and the owner has not
asked to change it), saved-payment-method management, GST invoices, annual billing, and live plan
changes between paid plans (a Kitchen Pro purchase from Ordering uses the existing checkout and has
not been exercised against the provider sandbox).

## Slice 3 as built: downgrade grace and hiding extra dishes

Migration `0081_plan_overflow.sql` (forward-only). Inert until the owner-only switch
`app_private.plan_settings.overflow_hiding_enabled` is turned on (default OFF), and the worker sweep
additionally needs `PLAN_LIMITS_ENFORCED=true` in the **worker's** environment (set it on web and
worker together, like the other shared flags).

**Decision: only dishes are hidden.** QR codes, tables and chairs are never switched off after a
downgrade. A printed QR link is the free product (ADR 003), and shutting down table QR codes or floor
tables in a running restaurant would be the most damaging thing a plan limit could do. They stay
usable and only growth is blocked. This corrects the earlier draft of the cap table, which proposed
suspending extra QR codes.

How it works:

1. **Detect.** Every 15 minutes the worker calls `reconcile_plan_overflow(caps)`. The caps come from
   the reviewed catalog (`{"0":20,"1":200,"2":2000}`), never from SQL. An outlet is "over" when it has
   more live dishes (published, non-archived, de-duplicated across its menus) than its plan allows.
2. **Grace.** The first time an outlet is seen over its cap it gets `overflow_grace_days` (default 14).
   Nothing is hidden. The clock starts when the switch is turned on, not before, so enabling it gives
   every over-cap owner a full grace period. If the plan or cap changes under an overflow, the grace
   restarts.
3. **Hide.** After the grace, dishes beyond the first N in **menu order** (menu, then category, then
   dish position) are recorded as hidden. Owners control which dishes stay by reordering or removing
   dishes. Categories left empty by hiding disappear from the guest menu.
4. **One filter, everywhere.** The filter sits inside `free_menu_public`, the function the public menu,
   order validation and the POS catalog all use, so a hidden dish cannot be seen, quoted or ordered
   anywhere. A test submits an order for a hidden dish and gets "is not currently on the menu".
5. **Restore.** Hidden rows remember the plan rank they were hidden under; the filter ignores them as
   soon as the outlet's current plan is higher, so an upgrade restores every dish immediately, before
   the worker runs. The next sweep then clears the rows. Freeing space, or turning the switch off,
   also restores (the switch is read live by the filter).
6. **Never deleted.** The owner's menu, drafts and releases are untouched; the hidden list is a separate
   table. Community Edition and uncapped plans are never affected.

What owners see: the dishes meter on Menu Studio, the Plan & usage panel and `/billing` show a notice. During grace: "After 2 Dec 2026, dishes beyond the first 20 are hidden from
guests. Nothing is deleted." Once hidden: "7 dishes are hidden from guests. They are safe and come
back when your plan allows or you free up space."

Operator notes (migration-owner connection only), after running the cap audit:

```sql
UPDATE app_private.plan_settings SET overflow_hiding_enabled = true;   -- start the grace clocks
UPDATE app_private.plan_settings SET overflow_grace_days = 14;         -- optional
UPDATE app_private.plan_settings SET overflow_hiding_enabled = false;  -- instant restore, no data change
```

Limits and caveats: the public menu cache (180 s) delays visibility changes by up to three minutes
because the worker deliberately has no Redis access; with several menus the "first N" order is by
menu id, so trim to one menu when over the cap; owners do not yet get a per-dish "hidden" badge or an
email when the grace starts (the notice is in the dashboard); the dish count excludes archived
dishes, while the creation guard counts every dish in the draft, so the guard can be slightly
stricter than the hiding rule. Hidden dishes are also unavailable at the till, because the POS reads
the same catalog.

## Auto-trial and payment-failure grace (migration 0082)

Two owner-controlled features, both **on by default since migration 0086**, built on ordinary time-boxed entitlement
grants so every existing gate (ordering, plan caps, overflow) keeps working unchanged.

**Automatic trial.** The first time an organization **owner** publishes a menu, the organization gets a
one-time N-day Ordering trial (default 14) as a grant with operator `auto-trial`. `claim_auto_trial` runs
inside the publish transaction and can never raise, so publishing is never affected. It starts only when
the switch is on, the owner has a verified email, the outlet is not the demo, the edition is not
Community, and the organization has **never** held an ordering grant or a subscription. It is claimed
once per organization **and once per owner account** (`trial_claims`), so extra workspaces cannot farm
trials. When it ends the organization simply falls back to Free (and the dish-overflow grace applies).

**Paying during a trial.** A verified charge first ends the trial (and any retry grace) and then records
the paid grant, so a real payment can never be rejected for overlapping a free window. The remaining
trial days are replaced by the paid month starting today, and the UI says so before the owner pays. The
checkout API now asks `entitlement_blocks_checkout` instead of "is any grant active", so a trial or a
retry grace no longer blocks subscribing; any real paid or operator grant still does.

**Failed renewals.** When the provider reports a failed renewal on a previously paid, not-cancelled
ordering subscription, a `dunning-grace` grant (default 5 days) begins where current access ends, once
per billing cycle however many failure events arrive. It ends the moment the subscription is halted,
paused or expired, or a payment succeeds. The provider's own retry schedule is unchanged. Kitchen Pro is
untouched (its commerce is not enabled).

**What owners see.** The dashboard widget and `/billing` show the trial ("Trial · 9 days left", the
next-plan tile becomes "Keep after your trial" with "Subscribe to keep Ordering"), a warning in the last
three days, and payment problems: "We could not renew your plan" with the grace date while retrying, and
"Your subscription has stopped" (menu and QR codes keep working) once halted. Payment problems are shown
to owners and admins only; staff see the trial but not billing trouble.

Operator switches (migration-owner connection only; no deploy needed):

```sql
UPDATE app_private.plan_settings SET auto_trial_enabled = true;            -- start trials on first publish
UPDATE app_private.plan_settings SET auto_trial_days = 14;                 -- 1 to 90
UPDATE app_private.plan_settings SET dunning_grace_enabled = true;         -- grace on failed renewals
UPDATE app_private.plan_settings SET dunning_grace_days = 5;               -- 1 to 30
UPDATE app_private.plan_settings SET auto_trial_enabled = false;           -- stop new trials (existing ones run out)
```

Caveats: trials are granted per verified email owner, so a determined person with many verified
mailboxes can still farm them (the trial only enables Ordering, with the Free caps' higher tier, and is
revocable); there is no email or push reminder yet, only in-app notices; the grace is our own and
cannot extend the provider's retries; operator-granted trials (`trial_7`, `trial_30`) still overlap a
paid charge as before and must be revoked by an operator first; enabling the trial changes who can take
online orders, so turn it on only after the ordering release gates for your deployment and update the
pricing-page copy in the same release.

## Final four-tier pricing (owner-approved 2026-11-02)

| Tier        | INR per month | Outlets             | Dishes per outlet   | QR codes            |
| ----------- | ------------- | ------------------- | ------------------- | ------------------- |
| Free        | 0             | 1                   | 20                  | 2                   |
| Ordering    | 119           | 1                   | 200                 | 25                  |
| Kitchen Pro | 499 flat      | Up to 10            | 2,000               | 200                 |
| Dedicated   | 30,000        | Virtually unlimited | Virtually unlimited | Virtually unlimited |

All amounts live in one place, `src/modules/billing/catalog.ts` (prices) and `src/modules/plans/catalog.ts`
(limits). The pricing page, `/billing`, the dashboard widget, the marketing copy and checkout all read
them, so a number cannot differ between screens. The earlier INR 299 Kitchen Pro price and the
Dedicated setup-fee placeholders are superseded.

**Dedicated** is sold by contract, not checkout: its card says "Talk to us about Dedicated". The domain
and branding setup is done by the team; the in-app custom-domain feature is not built.

**Kitchen Pro (provider side).** The webhook refuses a charge below the catalog amount, so the operator
creates a monthly INR 499 plan and sets `RAZORPAY_PLAN_KITCHEN_ID`. There is no legacy INR 299 plan: the
product has not launched, so there are no existing subscribers. See `docs/operations/razorpay-billing.md`.

**No double billing.** Kitchen Pro includes ordering. A verified Kitchen Pro payment now cancels the
organization's Ordering subscription at the end of its paid cycle (paid days stay active), as a retryable
webhook step; the billing page warns the owner before they pay. Organizations that were billed for both
before this fix can be found with `scripts/billing-double-billing-audit.ts` (read-only).

**Outlet limit.** Adding an outlet is capped per plan (Free and Ordering 1, Kitchen Pro 10) behind
`PLAN_LIMITS_ENFORCED`, with a meter shown where it means something. Organizations already over the
limit keep working and cannot add more; the cap audit now reports outlets too.

**Kitchen Pro is one flat price.** The owner decided (2026-11-02) to sell Kitchen Pro at a flat INR 499 for up
to 10 outlets, so there is no per-outlet add-on and nothing to build for it.

**Switches ship on.** From migration 0086 all four owner switches (free order intake, overflow hiding,
automatic trial, payment-retry grace) are on, and `PLAN_LIMITS_ENFORCED` defaults to true. Each can still be
switched off with a single `UPDATE app_private.plan_settings` (or `PLAN_LIMITS_ENFORCED=false`).

**Reminder emails (migration 0087).** Three reminders go to organization members with a verified email, once
per recipient and event: _trial ending_ (3 days or less left, to the owner), _payment failed_ (when the
retry-grace window opens, to owners and admins) and _grace ending_ (a day before, to owners and admins). The
database decides what is due and records each reminder once; the worker sends it every 15 minutes and
retries a failed send up to 5 times. A reminder is dropped if the customer has paid in the meantime. All mail
now uses one shared template (`src/lib/email/template.ts`: HTML with a plain-text twin, dark mode, escaped
text, same-origin links only). The worker needs the mail settings in `docs/environment.md`; without a real
provider the reminders simply stay off.

## AI credits and photo storage (migration 0088)

**AI credits.** Each organization has a monthly allowance pooled across its outlets: Free 10, Ordering 150,
Kitchen Pro 1,000, Dedicated by contract (never refused, still recorded). It resets at the start of each UTC
month with no rollover, and only counts while plan limits are enforced.

| Action                       | Cost                                  | Where it is charged                                                  |
| ---------------------------- | ------------------------------------- | -------------------------------------------------------------------- |
| One assistant message        | 1 credit                              | In the transaction that creates the turn (`beginTurn`)               |
| One dish autofill suggestion | 1 credit                              | Before the provider call; refunded if nothing is produced            |
| AI menu import               | 1 credit per ready page or photo      | In the same transaction as the enqueue (`submitImportForProcessing`) |
| Menu concierge for guests    | Not charged (its own separate budget) | n/a                                                                  |

- The ledger (`app_private.ai_credit_usage`) is private. `ai_credit_spend` takes an advisory lock per
  organization, so concurrent requests can never overspend; a refusal changes nothing. The cap is passed from
  the reviewed catalog, the same way as the media budget.
- When the allowance is used up the API answers `AI_CREDITS_EXHAUSTED` (HTTP 402) with the limit, the reset
  date and the next plan. Manual editing keeps working; no overage is billed.
- A failed assistant message and a failed dish autofill give their credit back. Import credits are **not**
  refunded if the provider later fails a page, because the requests were made.
- The existing safeguards (daily per-user and per-organization limits, the model spend cap in USD) are
  unchanged and still apply on top.

**Photo storage.** The existing per-outlet upload budget is now the plan's cap while limits are enforced:
Free 100 MB, Ordering 300 MB, Kitchen Pro 500 MB **per outlet** (Kitchen Pro's 10 outlets can therefore hold up
to 5 GB in total). Dedicated and any deployment with limits off keep the operational default
(`MEDIA_OUTLET_BUDGET_BYTES`). An upload that does not fit is refused with `LIMIT_REACHED` ("Your plan allows
100 MB of photo storage") and the upgrade pointer; the generic hourly upload limit keeps its own message.
Nothing already stored is ever removed. Only dish photos count, exactly as the upload budget counts them.

**Meters.** "AI credits" (with the reset date) and "Photo storage" appear on the billing page, the plan panel
and, when close to the limit, the dashboard widget. They are not added to the Menu Studio strip.

**Decisions to confirm.** (1) Storage is per outlet, not per organization. (2) The credit costs above; the
table is the place to change them (`AI_CREDIT_COSTS`). (3) Import credits are charged at submission and not
refunded on a later provider failure.
