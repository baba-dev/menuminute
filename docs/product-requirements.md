# Approved product requirements

Approved by the product owner on 15 October 2026. This is the target contract, not a claim that
the SQLite/NextAuth scaffold implements these features. Later decisions here supersede earlier
India-only, single-outlet, dine-in-only and USD/INR-only outlet assumptions.

## Market, ownership and hierarchy

The product serves restaurants, diners, cafes, takeout businesses, cloud kitchens, hotels and mixed
food-service businesses worldwide. Countries are not restricted to India. Country, IANA timezone,
locale, transaction currency and platform billing currency are independent settings.

| Entity        | Responsibility                                                                                      |
| ------------- | --------------------------------------------------------------------------------------------------- |
| Organization  | Tenant boundary; ownership, memberships, subscription and shared administration                     |
| Brand         | Customer-facing identity and reusable dish catalog                                                  |
| Outlet        | Physical or operating location; owns orders, hours, timezone, currency and kitchen operations       |
| Menu          | Published selection assigned to authorized brand/outlet combinations; schedules and local overrides |
| Service point | Optional table, counter or room identifier scoped to an outlet                                      |

Brands and outlets have an organization-scoped many-to-many relationship: several cloud-kitchen
brands may share an outlet and one brand may operate at several outlets. Menus are not a rigid
ownership parent between an outlet and its service points. Enforce all assignments within the same
organization; a shared kitchen must never become a cross-tenant access bypass.

A user exists independently of organizations and can hold memberships in several. The creator
becomes organization Owner with all operational permissions. Automatically create a default brand
and first outlet so a single-restaurant owner need not configure enterprise structure manually.
Map existing restaurant records explicitly during migration; do not leave parallel authorization trees.

## Outlet-centered onboarding and interface

Signup -> owner account and organization -> first outlet type -> country/timezone/local currency ->
fulfillment modes and hours -> menu setup -> preview/publish -> relevant QR codes.

| Outlet type          | Default interface emphasis                              | Fulfillment configuration        |
| -------------------- | ------------------------------------------------------- | -------------------------------- |
| Restaurant / Diner   | Tables, service staff and kitchen                       | Dine-in; optional pickup         |
| Cafe / Quick Service | Counter, preparation and collection                     | Pickup; optional dine-in         |
| Takeout              | Incoming orders, pickup details and collection          | Pickup                           |
| Cloud Kitchen        | Brands, incoming tickets and consolidated kitchen queue | Pickup                           |
| Hotel / Food Service | Scheduled menus and service points                      | Dine-in; optional pickup         |
| Other / Mixed        | Guided configuration and fulfillment filters            | Merchant chooses supported modes |

Outlet type describes a business; fulfillment mode describes how an order is fulfilled. Launch
supports dine-in and takeout/pickup, including cloud kitchens. It does not implicitly enable courier
delivery, marketplace integrations or hotel room-service workflows. A room service-point identifier
alone does not implement room service. Mixed outlets label/filter tickets by fulfillment mode.

Each additional outlet has its own type/settings. Owners can change type without losing menus,
orders or QR links. Mode changes apply to new submissions; existing tickets preserve original mode.
Role permissions still govern every screen/action. Complete guest, owner and kitchen UX flows,
including error/loading/offline/empty states, require review before their implementation slice.

## Permission matrix

Roles are composable, scope-limited permission bundles. Owner has every operational role by default
and may delegate acceptance. Hiding UI is not authorization; services, jobs and event streams enforce
current organization membership and assigned outlet/brand scope. No implicit platform-admin access.

| Action                                               | Owner | Organization Admin | Outlet Manager        | Service Staff | Kitchen Staff | Menu Editor |
| ---------------------------------------------------- | ----- | ------------------ | --------------------- | ------------- | ------------- | ----------- |
| Ownership transfer / organization deletion / billing | Yes   | No                 | No                    | No            | No            | No          |
| Organization settings and non-owner memberships      | Yes   | Yes                | No                    | No            | No            | No          |
| Assigned outlet settings and staff assignment        | Yes   | Yes                | Yes, within own scope | No            | No            | No          |
| Assigned catalog/menu editing and publishing         | Yes   | Yes                | Yes                   | No            | No            | Yes         |
| View operational orders in assigned outlets          | Yes   | Yes                | Yes                   | Yes           | Yes           | No          |
| Accept / decline pending orders                      | Yes   | Yes                | Yes                   | Yes           | No            | No          |
| Mark preparing / ready                               | Yes   | Yes                | Yes                   | No            | Yes           | No          |
| Mark served / collected and record payment           | Yes   | Yes                | Yes                   | Yes           | No            | No          |
| Cancel accepted work, with recorded reason           | Yes   | Yes                | Yes                   | No            | No            | No          |

Staff assignment cannot grant permissions beyond the actor's own scope or elevate an outlet member
to organization administration. Owner-only lifecycle/billing controls require explicit ownership checks.
Audit membership, menu pricing/publication, acceptance, cancellation and payment changes.

## Menu and dish contract

- Support both variants and add-on groups, required/optional choices and selection rules. Validate
  compatible selections and prices server-side; selected options are snapshotted with the order.
- No merchant-facing maximum quantity cap. Require positive whole quantities, checked arithmetic,
  supported numeric representation and request-size/rate protections; do not introduce a hidden
  business quantity limit. Reject values that cannot be represented safely with a clear error.
- Sold-out dishes remain visible, with a greyed image, Sold Out overlay, accessible text and disabled
  ordering. The text also appears on image-less dishes. Revalidate sold-out state at submission.
- Distinguish draft/published, scheduled, sold out and archived. Support outlet-local schedules,
  multiple service windows, overnight hours and date exceptions. Published availability changes
  invalidate relevant caches; a cached menu never authorizes a stale order.
- Shared dishes may have outlet-specific price/availability overrides. A default menu can be reused
  without merging independent outlet currency or operating settings.
- Complex combos, nested modifier groups and size-dependent add-on prices need explicit calculation
  examples before implementation; general approval of dish structures does not supply those rules.

## Order lifecycle, closing and QR continuity

- Every confirmed submission creates a separate ticket with immutable item, option, price, tax,
  currency and fulfillment snapshots. Repeat/additional orders create separate tickets; editing
  submitted orders is deferred. Retrying the same submission key returns its original result.
- Guests explicitly review price or availability changes before confirming. Confirmation appears
  only after database commit; submission is separate from restaurant acceptance.
- Only authorized staff accept/decline pending work. Cancellation requires permission and a reason.
- Dine-in: pending -> accepted -> preparing -> ready -> served. Pickup follows the same preparation
  stages and ends collected. Rejected, cancelled and expired are explicit terminal outcomes.
- Fulfillment and payment remain independent: served/collected never implies paid. Launch payments
  are handled at the restaurant/counter, not through a diner payment gateway.
- Organization hours are defaults; outlet-local service sessions determine expiry. Snapshot pending
  expiry at the applicable closing instant. For a session 18:00-02:00, a 23:45 submission expires at
  02:00 the next day. Accepted/preparing orders continue after closing. A 24-hour outlet requires an
  explicit business-day cutoff. Schedule edits must not silently rewrite existing order deadlines.
- Acceptance and expiry compete atomically using database time, expected state/version and the
  stored deadline. Expiry is enforced on reads/actions as well as recoverable background work, so
  a worker outage cannot leave an overdue order acceptably pending.
- QR URLs remain valid until the organization administrator deletes or recreates/regenerates them.
  Renames, menu edits, outlet-type changes and subscription expiry preserve the printed link. Admin
  deletion/regeneration explicitly revokes the old token; history retains its service-point snapshot.
  Organization deletion or abuse suspension can disable access without silently rotating the token.
- Permanent QR identity is separate from temporary guest sessions and order tracking capabilities.
  A copied QR is public, not physical-presence proof. Staff acceptance and abuse controls apply.
- Offline browsing can show labelled cached public content. Submission requires connectivity; an
  uncertain submission is reconciled by its original key before another ticket is created. Never
  automatically replay offline order submissions.

Pickup customer-name/contact requirements, ASAP versus scheduled pickup, missed collection and
the interaction between scheduled pickup and closing-time expiry remain UX/business-rule inputs.
Do not invent mandatory phone collection or a scheduled-pickup promise in the implementation.

## Currency, calculations and commercial boundary

| Currency domain                   | Contract                                                                                                   |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Food Minutes subscription billing | Platform accepts USD or INR; exact prices/collection provider remain separate decisions                    |
| Outlet transactions               | Any supported local currency, suggested by geography and confirmed by the merchant; not limited to USD/INR |

One transaction currency per outlet. Store explicit ISO currency and minor-unit precision; support
zero-, two- and three-decimal currencies without floating-point monetary math or ambiguous symbols.
Validate selectable currencies against a maintained supported catalog rather than arbitrary strings.
Different outlets in an organization may use different currencies. Snapshot currency/amounts on orders;
currency changes require explicit price review/update and preserve historical money. Reports group
totals by currency; never add unlike currencies without an explicit exchange-rate conversion policy.

Worldwide signup does not establish worldwide legal/tax compliance. Before enabling transactions in
a jurisdiction, specify applicable tax-inclusive/exclusive pricing, item tax categories, discount and
service-charge treatment, rounding sequence, receipt/invoice fields and retention rules. Merchant
food-sale calculations and platform subscription tax are distinct. Currency is not a tax-jurisdiction
selector. Jurisdiction-specific policies and examples are implementation/release gates, not invented
universal rules. Diner online payments remain deferred; merchant billing provider is not selected.

Free QR menus remain useful after a paid plan ends; printed links still open the menu. New orders
are gated by entitlements while active accepted tickets can finish. Exact plans, quotas, trial/grace,
retention and billing operations remain commercial inputs; earlier INR 149/299 figures are hypotheses.

## Capacity and production evidence

Initial planning envelope: 25 owners, 50 restaurants/outlets and their menus, 1,000 orders/hour
aggregate. This does not cap brands/menu counts or promise unlimited capacity. Clarify expected
menu counts, simultaneous guests/staff/SSE connections and peak burst distribution for load fixtures.

At 1,000 orders/hour, average submission rate is about 0.28/second; benchmark realistic bursts,
menu reads, transitions, reconnects, jobs and one noisy tenant on the ARM64 host alongside ERP.
Record latency/error/backlog/resource thresholds before the load gate. Growth uses additional web
capacity, workers and database resources subject to measurement; no seamless or million-order
throughput guarantee follows from the schema or server inventory. Agree SLO/RPO/RTO and rehearse
off-host restoration before public/paid launch.

## Required acceptance evidence

- Multi-organization memberships; cross-brand/outlet denial; shared-cloud-kitchen isolation; role
  composition, delegation and revocation; migration from existing restaurant records.
- Outlet-type onboarding/defaults, mixed fulfillment, changing type/mode without breaking old tickets.
- Variants plus add-ons, sold-out display/revalidation, overnight schedules and date exceptions.
- Large safe quantities, overflow rejection, zero/two/three-decimal local currencies, independent
  USD/INR subscriptions, historical price/currency snapshots and per-currency reporting.
- Duplicate submit/lost response reconciliation; separate repeat tickets; price-change confirmation;
  acceptance-versus-expiry races; worker outage/restart; 24-hour cutoff; accepted work after close.
- Permanent printed QR after renames/plan/type changes; explicit deletion/regeneration revocation;
  expiry of guest session without invalidating the QR; no private/offline order replay.
- Reviewed complete UX, recovery/load/restore evidence and native ARM64 CI. These are future runtime
  gates; documentation approval and existing SQLite tests do not establish their implementation.
