# Dining floor release verification

PR #259 added the first visual dining floor (drag canvas). It is superseded by the chairs-and-sections floor
described in [dining-floor.md](dining-floor.md) (migration 0070); the evidence below applies to the new floor.

## Required evidence

- Run the pinned formatting, lint, strict TypeScript and production build commands.
- Run all PostgreSQL and Redis integration tests, including the dedicated floor test.
- Verify the fixed public demo reset restores historical orders, kitchen work and stable menu revisions.
- Test one real dine-in QR scan through menu, ordering, kitchen and POS against the correct table.
- Create a table with chairs, tap chairs and "Seat party", and confirm totals and the hero copy update.
- Confirm a table with seated guests, open orders, bookings or a live QR cannot be archived.
- Confirm legacy tables created before migration 0070 are absent from the floor but their QR codes and
  historical orders still resolve.
- Test a date boundary in the restaurant timezone and concurrent booking requests.
- Capture desktop and mobile screenshots (light and dark) for the floor, the add-table dialog and the booking dialog.
- Confirm that active orders, active reservations and QR-linked tables block archival.
- Record the tested full commit SHA and CI run before approving a deployment.

## Safety boundaries

Floor reservations do not activate billing, fiscal operations or kitchen entitlements.
Migration 0068 extends the approved demo reset; it does not provision another
production demo tenant. A merge is not a deployment. Production migration requires
the configured backup, release identity and existing Oracle VPS deployment gates.

## Status

Automated evidence must come from the final CI run on the final PR head.
Browser screenshots and operator-backed release checks are not yet established
by the implementation commits alone.
