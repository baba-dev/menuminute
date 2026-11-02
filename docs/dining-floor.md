# Dining floor (tables, chairs, sections, occupancy)

Status: **implemented in code; not deployed.** Migration `0073_floor_chairs_and_sections` ships with this
change and reaches production only through the normal gates in [production-runbook.md](production-runbook.md).

## What the owner sees

`/dashboard/floor` is a section list, not a drag canvas. A hero with hand-written copy and live numbers,
four KPI tiles (total tables, total chairs, maximum occupancy, sections), section filter chips, and one
"at a glance" card per table: the table illustration with its real chairs, who is seated, open orders,
the next booking and the permanent system ID. It reuses the dashboard shell tokens (`.mm-dashboard-hero`,
`--paper`, `--ink`, `--muted`, `--ember`, `--decorative`), the `DashboardTooltip` help popover and Radix dialogs.

## Live table signals (optional, slices 1-5 of 6)

Status: **implemented in code; not deployed.** Migration `0090_table_signals` (additive, forward-only).
An owner switch ("Live table signals", needs `menu.write`; `PUT /api/floor/signals`) turns on a guest-journey strip
on each table card: QR scanned, order sent (with dish count), cooking, ready for handoff, delivered, bill shown,
paid and water. It is **off by default**; with it off no signal query runs and the card is unchanged. Sub-toggles
(`qr_scan_pings`, `guest_water_button`, `show_kitchen`, `show_pos_bill`) hide each source's indicators.

- Tables: `floor_signal_settings` (per outlet) and `table_signal_events` (append-only, outlet RLS, unique
  `dedupe_key`, small non-personal `meta`). Staff can read the ledger; there are no app-role write grants yet.
- Today only order status and payment drive indicators (derived from the table's latest order in the last 6 hours).
  Ledger producers so far: the QR scan, guest service requests (water, bill request), order status changes and payment. Bill shown is recorded when a POS bill is frozen.
- `buildJourney` (`src/modules/hospitality/floor-signals.ts`) is the pure view-model; `JourneyStrip` renders inline SVG
  icons with text states (idle / active / done) and honours `prefers-reduced-motion`.
- **QR scan ping (slice 2, migration `0091_qr_scan_signal`).** The public menu sends one beacon per browser session
  per table QR (`POST /api/public-orders/scan`, under the Nginx prefix that already attaches the signed client
  identity; same origin check and Redis limits as other guest calls). `app_private.record_qr_scan(token)` records a
  `qr_scanned` event only for an active QR tied to an active table, only when the outlet enabled signals and the QR
  ping, and at most once per QR per minute. It also increments `qr_codes.scan_count`, which was never incremented
  before, for any active QR. A scan means a phone opened the QR, not that a guest is seated. The worker prunes
  signals older than 48 hours (`app_private.prune_table_signals`, with the six-hourly kitchen maintenance).
- **Guest water button (slice 3, migration `0092_guest_table_water`).** On a menu opened from a QR tied to a table, and
  only while the outlet enabled signals and the water source, the menu shows "Request water"
  (`GET /api/public-orders/table-service`, `POST /api/public-orders/water`; same guard as the scan beacon). One open request
  per table, a new one allowed 60 seconds after the last. The request reuses `guest_service_requests`
  (`order_id` is now nullable for water refills, `qr_id` added), so it appears in the existing service-requests queue
  and staff use the existing acknowledge/resolve action; the floor card also offers "Acknowledge water request" and
  "Mark water served" (`POST /api/floor/water`, authorization in `staff_service_request_action`). A trigger writes
  `water_requested`/`water_acknowledged`/`water_served` (and `bill_requested` for existing order-bound bill requests)
  to the ledger in the same transaction, only while the outlet opted in. The button never promises a time.
- **Order, kitchen and payment signals (slice 4, migration `0093_order_kitchen_signals`).** Every order status change
  already writes `order_status_events` (guest, staff, kitchen, expo and POS paths), so one trigger there records
  `order_placed`, `order_accepted`, `kitchen_preparing`, `kitchen_ready` (handoff) and `order_served` with the real status
  time, and a second trigger records `paid` when `orders.payment_status` becomes `paid`. They write only for orders at a
  table, only while the outlet opted in (kitchen kinds need the kitchen source, `paid` needs the POS source), idempotently
  (`ord:<order>:<kind>`). No order, kitchen or POS code or behaviour changes. The journey takes each step's time from the
  event for the table's latest order and falls back to the order's last update.
- **POS bill and payment (slice 5, migration `0094_pos_bill_signal`).** "Place order and send" stays the only order
  button. Recent Orders & Sales gains **Show bill** and **Record payment** on unpaid, live orders
  (`registerBillingActions`, `src/modules/pos/register-actions.ts`). Both open The Ledger on the exact sale
  (`/dashboard/pos/ledger?sale=<id>&focus=bill|payment`, scrolling to the bill or settlement step), so the existing
  finance commands still decide everything: Show bill is the immutable bill freeze, Record payment is the manual
  tender attestation, which needs an open shift and a frozen bill, and the existing permissions and entitlements
  apply. An order with no POS sale yet opens the Till (`?attachOrder=`) to be attached first. Freezing a bill inserts
  `pos_bills`; a trigger there records `bill_presented` for the sale's table order (opted-in outlets with the POS
  source only, idempotent, at the bill's own time). Paying records `paid` through the slice 4 trigger. The old
  `refundSale` link still works.
- The floor card no longer shows the permanent System ID. It is still in the API and the table edit dialog.
- Remaining slices: demo sample events and the Ember (assistant-action) toggle.

## Domain rules

- **Chairs are records** (`restaurant_chairs`). A chair belongs to at most one table and may be unassigned.
- **Capacity is derived**: `restaurant_tables.capacity` is maintained by trigger as the count of active chairs.
  Clients can never send capacity. The booking guard (`floor_booking_table_capacity`) keeps reading that column.
- **Occupancy is staff-set**: a chair is taken when `occupied_at` is set. Orders and reservations are shown as
  context only and never change a chair. Maximum occupancy = active chairs; current occupancy = taken chairs.
- **Occupancy commands** (`app_private.floor_set_chair_occupied`, `floor_seat_table`, `floor_clear_table`) need
  `orders.accept` and are the only way to change `occupied_*`/`version`; the app role has no column grant on them.
  A repeat of the requested state is a no-op; a stale `version` is a conflict. Moving, unassigning or retiring a
  chair frees it (trigger), so occupancy never leaks between tables.
- **Structure** (tables, chairs, sections) needs `menu.write`, enforced by service checks and RLS.
- **Limits**: 30 chairs per table, 200 tables and 1,500 chairs per outlet, 24 sections.
- **Archive, never delete**: a table with open orders, bookings, a live QR or seated guests cannot be archived.
  Its chairs return to the unassigned tray. Archived tables free their number for reuse.
- **System ID** (`restaurant_tables.id`) never changes. `display_number` is the human number, unique among
  active tables. `table_number` mirrors it so QR codes, orders and POS keep working.

## Dashboard miniature

The Overview widget "Your dining floor" (`src/components/dashboard/table-floor-matrix.tsx`) is a read-only
miniature of this page. It reads the same `getFloorOverview` (permission `orders.read`) plus the orders-only
`getOutletFloorMatrix` for unpaid totals, and each read degrades independently. `buildFloorGlance`
(`src/modules/hospitality/floor-glance.ts`) is the pure view-model: stat strip, tables grouped by section, at most
12 tables ordered by attention (unpaid, stale, active, seated), and up to three "needs attention" rows. Mini tables
reuse `layoutTable` so shapes and chair positions match the floor page. Tables link to `/dashboard/floor#table-<id>`.
The widget never changes chair state, and keeps the "not a physical occupancy sensor" disclaimer.

## Dashboard "Today's pulse" bento

A second Overview widget (`pulse`, label "Today's pulse") fills the right-hand column under "Guest service".
`getTodayPulse` (`src/modules/dashboard/today-pulse.ts`, permission `orders.read`) reads only this outlet's orders and
order items for the outlet-local business day: sales and an hourly rhythm (with change versus the same elapsed time
yesterday), the top three dishes by quantity, guests currently waiting (average and oldest age of open orders), and
new versus returning guests. A "new guest" is a phone number with no earlier order at the outlet; numbers are only
counted, never returned. Orders carry no per-status timestamps, so the waiting tile is the age of open orders, not a
kitchen preparation time. The widget is read-only and refreshes about every minute.

## Migration 0073 (additive)

Adds `dining_sections`, `restaurant_chairs`, and `name`, `display_number`, `section_id`, `shape` on
`restaurant_tables`; replaces the all-rows unique index on `(restaurant_id, table_number)` with the same index
restricted to active rows; adds guard, capacity and default triggers. It deletes nothing.

Legacy handling ("regenerate with the system"): tables created before this change have no `display_number`, so
they are **not shown on the new floor**. Numeric legacy `table_number` values are renamed to
`legacy-<number>-<id prefix>` (reversible) so the numbers can be reused. QR codes, existing orders and POS still
resolve those rows. Nothing is hard-deleted; a purge, if wanted later, is a separate operator-run script after a
verified backup. `dining_floor_plans` (the old canvas JSON) is no longer read and can be dropped in a later
migration. Tables created by onboarding with numeric numbers receive a display number automatically and appear
on the floor with no chairs.

Rollback: the previous release ignores the new columns and tables; leaving them in place is safe.

## Demo

The public demo keeps its fixed tenant. `restaurant_tables_demo_seed` (after-insert trigger, hard-wired to
`is_demo_data` outlets) restores five demo sections, table shapes and one chair per seat each time the 30-minute
reset re-inserts the 12 baseline tables. Visitors may tap chairs and seat or clear tables
(`PUT /api/floor/chairs/:id/occupancy`, `POST|DELETE /api/floor/tables/:id/occupancy`); all other floor mutations
stay blocked for the demo actor. The reset wipes occupancy. See [demo.md](demo.md).

## API

| Route                                   | Method                  | Permission      |
| --------------------------------------- | ----------------------- | --------------- |
| `/api/floor`                            | GET overview            | `orders.read`   |
| `/api/floor/sections`                   | POST                    | `menu.write`    |
| `/api/floor/tables`                     | POST                    | `menu.write`    |
| `/api/floor/tables/:id`                 | PATCH, DELETE           | `menu.write`    |
| `/api/floor/tables/:id/occupancy`       | POST seat, DELETE clear | `orders.accept` |
| `/api/floor/chairs`                     | POST                    | `menu.write`    |
| `/api/floor/chairs/:id`                 | PATCH, DELETE           | `menu.write`    |
| `/api/floor/chairs/:id/occupancy`       | PUT                     | `orders.accept` |
| `/api/floor/reservations`, `/tables/qr` | unchanged               |                 |

## Evidence

`pnpm floor:verify`, `tests/floor-system-integration.test.ts` (real PostgreSQL: derived capacity, concurrent
duplicate numbers, one-tap idempotency and stale-version conflict, move frees chair, limits, cross-outlet
isolation, QR and archive guards, reservations), `tests/demo-reset.test.ts`, `tests/demo-guard.test.ts`,
`tests/floor-headline.test.ts`, `tests/floor-geometry.test.ts`, `tests/floor-state.test.ts`,
`tests/zoned-time.test.ts`. Browser evidence and the production rollout are recorded in
[floor-system-release-verification.md](floor-system-release-verification.md).
