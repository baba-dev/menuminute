# Dining floor (tables, chairs, sections, occupancy)

Status: **implemented in code; not deployed.** Migration `0073_floor_chairs_and_sections` ships with this
change and reaches production only through the normal gates in [production-runbook.md](production-runbook.md).

## What the owner sees

`/dashboard/floor` is a section list, not a drag canvas. A hero with hand-written copy and live numbers,
four KPI tiles (total tables, total chairs, maximum occupancy, sections), section filter chips, and one
"at a glance" card per table: the table illustration with its real chairs, who is seated, open orders,
the next booking and the permanent system ID. It reuses the dashboard shell tokens (`.mm-dashboard-hero`,
`--paper`, `--ink`, `--muted`, `--ember`, `--decorative`), the `DashboardTooltip` help popover and Radix dialogs.

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
