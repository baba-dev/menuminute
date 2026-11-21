# Tiffin & Home-Chef Hub — design

Status: **proposed, awaiting owner approval.** This is a planning document. Nothing here is
implemented, and it does not change the approved requirements; where it touches a rule the
requirements left open (scheduled pickup, delivery, customer phone collection), it records a
proposal for the owner to approve. Read it with [product-requirements.md](../../product-requirements.md),
[domain-invariants.md](../../domain-invariants.md), [plans-and-limits.md](../../plans-and-limits.md)
and [architecture-contracts.md](../../orchestration/architecture-contracts.md).

## Intent and why

Home chefs and tiffin services (messes, office-lunch cooks) are a food business MenuMinute does not
serve today. Their menu repeats weekly, they sell fixed combos and platters, they cook for a known
count of lunches and dinners each day, and their customers return daily. Serving them widens the
addressable base and turns one-off visits into repeat bookings.

A feature that is only advertised to this audience is not good implementation. Success means a real
tiffin owner can run a week of service from MenuMinute: publish the week's menu, take bookings and
subscriptions, know exactly what to cook and pack, deliver, and see who owes what, without a
spreadsheet beside it.

## What the owner approved in conversation

- Weekly predefined menus, separate for lunch and dinner. Dishes sold as combos and platters.
- Customers book **specific days** and can also hold **standing subscriptions**; both are in scope,
  delivered in phases.
- Subscription money is **paid outside the app**, tracked inside it, with a **prepaid meal balance
  (ledger)** the owner tops up and each meal deducts from. The app never moves money.
- A meal due on a subscription with too little balance is **still prepared and flagged as owed**; the
  balance goes negative and the owner decides. The app never cuts a customer off.
- The owner **delivers**, with a simple per-area route list. No live tracking, rider assignment or
  delivery fees.
- Combos are **fixed bundles with optional add-ons**. Sizes (for 2 / for 4) are separate combos.
- Each slot has an owner-set **cutoff** and an optional **meal cap**; after cutoff the job card locks.
- Repeat customers are on an **owner-managed customer list**; subscribers use a private link, with no
  public sign-up or password.
- **Free** plan covers weekly menus, combos and day-by-day booking; **Ordering (₹119)** covers
  subscriptions, the ledger, job-card printing and delivery lists.
- Job card shows: prep totals, per-customer packing list, delivery route by area, printable and
  shareable.
- A new outlet type, **Tiffin / Home Chef**.

## Goals

1. A tiffin outlet type with onboarding defaults for scheduled meals and delivery or pickup.
2. Weekly menu per slot (lunch, dinner), with per-date overrides and holidays.
3. Combos with fixed contents and optional priced add-ons, accurate in quotes and snapshots.
4. Day-by-day booking with server-checked cutoff and capacity.
5. Job cards: prep totals, packing list, delivery route, print and expiring share.
6. Subscriptions that generate bookings, with pause and skip.
7. An append-only balance ledger with owner top-ups, deductions, dues and reversals.

## Non-goals

- Online payment, payment-provider calls, refunds or settlement. Money is recorded, never moved.
- Courier delivery features: live tracking, rider accounts, assignment, fees, marketplace sync.
- Customer self-service accounts, passwords or social login.
- Nested or choose-one combo slots (customer picks the sabzi). Deferred; the docs require worked
  pricing examples first.
- Nutrition, allergen or dietary safety claims. Combo contents are merchant text; nothing is inferred.
- AI-generated menus or auto-publishing.

## Anti-goals (would fail even if it "works")

- Weakening the existing order guarantees for restaurants, or changing their behavior.
- A balance that can be silently edited, or that drifts from the sum of its entries.
- Customer addresses or phones reachable by another tenant, or by anyone holding a stale share link.
- A job card whose numbers differ from the bookings that created it.
- Overbooking past a cap because two bookings raced.

## Constraints from the repo

- `orders.fulfillment_mode` is `"dine_in" | "pickup"` only; delivery is explicitly not implicit
  ([product-requirements.md](../../product-requirements.md)). Adding delivery is a contract change and
  needs an ADR and the contract-change protocol.
- The docs say scheduled pickup and customer phone collection "remain UX/business-rule inputs; do not
  invent". This design proposes both for tiffin bookings only and needs explicit owner approval.
- Menu weekly windows are browse-only and "not an order-expiry or scheduled-pickup contract"
  ([menu-product/contracts.md](../../menu-product/contracts.md)). Booking cutoffs are new and separate.
- `orders.requested_fulfillment_at` already exists and is the natural carrier for the meal time.
- `outlets.outlet_type` is free text, so a new type needs validation and onboarding changes but no
  column change.
- `crm_guests` already keys a person by organization and E.164 phone and may serve as the subscriber
  identity (builder to confirm; see Left to the builder).
- Server prices, availability and entitlements are authoritative; money is integer minor units;
  business change and outbox intent commit in one transaction; consumers are idempotent.
- Production is Linux ARM64 beside the live ERP; this work is a new migration sequence and must follow
  [automatic-migration-deployment.md](../../automatic-migration-deployment.md). No `db:push`.

## Approaches considered

| Approach                                       | Trade-off                                                                                                        |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| A. Extend menus and orders in place            | Least new code, but bends tables shared by every restaurant; menus have no order-time schedule today.            |
| B. Separate tiffin module with its own orders  | Cleanest isolation, but re-implements idempotency, snapshots, audit and entitlements, the riskiest code to copy. |
| **C. Planning layer that creates real orders** | **Chosen.** New module owns planning data; confirmed bookings create ordinary orders through the order service.  |

**Chosen: C**, by the owner. Why: orders keep every existing guarantee, and tiffin complexity stays in
one module that consumes the orders public contract and never writes its tables.

## Design

### Module and contracts

A new `src/modules/tiffin` owns: weekly menu plans, combos, slots, bookings, subscriptions, the
ledger and job-card read models. It calls the orders service to create the real order and stores only
a link to it (`booking.order_id`). The orders module gains the minimum needed: a `"delivery"`
fulfillment mode and an optional slot reference, added as an additive contract revision before the
tiffin consumer lands.

Routes and Server Actions stay thin; authorization (current membership, outlet scope) is enforced in
the services. Staff roles follow the existing matrix: owner, org admin and outlet manager manage plans,
ledger and subscriptions; kitchen staff may view job cards for assigned outlets; menu editors manage
weekly menus and combos but not the ledger.

### Data model sketch (names indicative; builder finalizes)

- `tiffin_slots`: outlet, slot kind (lunch/dinner), local meal window, cutoff rule, optional cap.
- `tiffin_week_menus` and `_entries`: weekday x slot -> combos offered; `tiffin_date_overrides` for
  holidays and specials.
- `tiffin_combos` and `_items` and `_addons`: fixed bundle contents (merchant text plus optional dish
  reference), price in minor units, add-on prices.
- `tiffin_customers`: owner-managed subscriber record (name, phone, delivery area, address), tenant
  scoped, with a hashed private-link token.
- `tiffin_bookings`: customer, slot date, combo + add-on snapshot, status, `order_id`, owed flag.
- `tiffin_subscriptions` and `_skips`: weekday pattern, combo, start/end, paused state.
- `tiffin_ledger_entries`: **append-only**; kind (top-up, meal deduction, reversal, adjustment),
  signed minor units, currency, booking or subscription reference, actor, reason, idempotency key.
  Balance is derived from entries; a database constraint rejects update and delete.
- `tiffin_areas`: owner-defined delivery areas for grouping.

Every table carries `organization_id` with composite foreign keys, as in `crm_guests`, so cross-tenant
links are impossible.

### Booking and capacity

Booking validates, on the server: slot is open (before cutoff, date offered by the menu or override),
combo and add-on prices are recomputed (client prices ignored), and capacity remains. Capacity is
enforced under a row lock on the slot-day counter so two simultaneous bookings cannot exceed the cap.
Submission is idempotent per key. A cached menu never authorizes a booking. The order and the booking
commit in one transaction with outbox intent.

### Subscriptions and the ledger

A worker job materializes tomorrow's (and the configured horizon's) subscription meals into bookings.
It is idempotent: one booking per subscription per slot-day, enforced by a unique key, so queue
redelivery cannot double-book. Skips and pauses are honored before materialization and until cutoff.
Each materialized meal writes a deduction entry in the same transaction as the booking; a balance below
zero sets the owed flag and never blocks. Corrections are reversal entries with a reason; nothing is
edited or deleted. All ledger writes are audited.

### Job cards

Read models for a date and slot: (1) prep totals (combos, then dish and add-on roll-up); (2) packing
list per customer; (3) delivery route by area with address, phone and amount owed. They lock at cutoff;
a late change by the owner after lock is explicit, audited and re-flags the card. Print uses a clean
layout. Share links are single-slot, expiring, token-based, revocable, and show only what a helper
needs; they never expose another date or customer list. Addresses are private customer data.

### Onboarding, plans and UI

`Tiffin / Home Chef` is added to the outlet-type list with defaults (scheduled meals, delivery or
pickup, tiffin dashboard). Existing outlets are untouched. Free keeps weekly menus, combos and
day-by-day booking, within existing caps; **combos should be counted separately from the 20-dish cap**
(proposal, needs owner approval). Subscriptions, ledger, job-card print and route lists require
Ordering. Entitlements are checked in services, never in the UI. Subscriber private link page: today's
and upcoming meals, skip or pause, balance, and top-up history, with loading, empty, error and offline
states per the design contract.

## Release order

1. **Contracts and foundations:** orders contract revision (delivery mode, slot link), ADR, outlet type,
   schema for plans, combos and slots, with executable rollback.
2. **Weekly menu and combos:** authoring, quotes, public view, date overrides.
3. **Day booking and job cards:** booking with cutoff and cap, orders integration, the three job-card
   views, print and share.
4. **Customers, ledger and subscriptions:** owner-managed list, private link, ledger, materialization
   job, skips, pauses and dues.

Each phase is one reviewable slice with its own acceptance evidence; later phases are not started
until the previous one passes. Merging is not deployment; production follows the runbook.

## Acceptance evidence (per phase, real PostgreSQL and Redis)

- Cross-tenant and cross-outlet denial for every new table and route; role matrix tests.
- Two concurrent bookings on the last unit: exactly one succeeds. Duplicate key returns the original.
- Booking after cutoff rejected on the server even with a cached menu; menu or price change forces
  re-confirmation.
- Existing restaurant order flows and tests unchanged.
- Materialization job run twice, and with worker restart mid-run: no duplicate bookings or deductions.
- Ledger: balance equals sum of entries; update and delete rejected by the database; reversal path;
  negative balance sets owed without blocking.
- Job card totals equal the bookings they summarize across edge cases (add-ons, skipped, paused,
  cancelled). Share link expiry, revocation and scope.
- Browser tests on mobile and desktop for owner and subscriber flows, light and dark; ARM64 CI green.

## Risks

- Delivery is a platform-contract change; it must be an ADR, and the "no delivery" public messaging
  must be updated so marketing does not overclaim (no tracking, no rider features).
- Storing home addresses raises privacy and retention duty. Needs a retention and deletion rule that
  also fits the account-deletion flow ([account-deletion-requests.md](../../account-deletion-requests.md)).
- Subscription volume stresses the worker; scale against the existing capacity envelope before launch.
- Recording owed money invites expectations of invoicing or statutory receipts. Messaging must say the
  ledger is a record, not an invoice or payment service.

## Left to the builder

- Exact table and index names, migration numbering (next is after `0113`) and rollback scripts.
- Whether `crm_guests` becomes the subscriber identity or `tiffin_customers` links to it.
- Slot-day counter design for capacity, cutoff time-zone and DST handling.
- Share-link token format and expiry defaults; print layout.
- Booking horizon for materialization (my call: 7 days ahead, configurable later).

## Calls I made that need your check

- Delivery as a new `"delivery"` fulfillment mode; a pickup option kept for tiffin as well.
- Phone number required for tiffin bookings only, not for ordinary restaurant guests.
- Combos counted separately from the Free 20-dish cap.
- Subscriptions materialize 7 days ahead; skips and pauses allowed until the slot cutoff.
- Reversal entries (never edits) for ledger corrections; one currency per outlet, as elsewhere.
- Share links expire (my default: end of the meal day) and are revocable.
