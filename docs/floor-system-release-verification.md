# Dining floor release verification

PR #259 adds a visual dining floor, durable table mutations, QR attachment and operator bookings.

## Required evidence

- Run the pinned formatting, lint, strict TypeScript and production build commands.
- Run all PostgreSQL and Redis integration tests, including the dedicated floor test.
- Verify the fixed public demo reset restores historical orders, kitchen work and stable menu revisions.
- Test one real dine-in QR scan through menu, ordering, kitchen and POS against the correct table.
- Test a date boundary in the restaurant timezone and concurrent booking requests.
- Capture desktop and mobile browser screenshots for the visual floor, booking dialog and QR standee.
- Confirm that active orders, active reservations and QR-linked tables block archival.
- Record the tested full commit SHA and CI run before approving a deployment.

## Safety boundaries

Floor reservations do not activate billing, fiscal operations or kitchen entitlements.
The new migration extends the approved demo reset; it does not provision another
production demo tenant. A merge is not a deployment. Production migration requires
the configured backup, release identity and existing Oracle VPS deployment gates.

## Status

Automated evidence must come from the final CI run on the final PR head.
Browser screenshots and operator-backed release checks are not yet established
by the implementation commits alone.
