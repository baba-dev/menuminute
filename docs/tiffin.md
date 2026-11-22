# Tiffin and home-chef hub

Status document for the Tiffin & Home-Chef Hub. Design: [approved spec](superpowers/specs/2026-11-21-tiffin-home-chef-hub-design.md).
Decision: ADR 032 in [decisions](decisions.md). Roadmap context: [product roadmap](product-roadmap.md).

Nothing in this document is deployed. Merging is not deployment; production follows the
[production runbook](production-runbook.md).

## Implemented

Phase 1 foundations exist in the codebase and are inert. They are not deployed by merging.

- Migration 0114: `outlet_type_valid` widened to allow `tiffin`, plus nine empty, RLS-locked `tiffin_*` tables
  (slots, combos with items and add-ons, week menus, date overrides, areas). Direct access is revoked from
  `menuminute_app` and `menuminute_worker`; no code path reads or writes them yet.
- The `TIFFIN_ENABLED` flag (default false) and `src/modules/tiffin/contracts.ts` (input schemas, `tiffinEnabled()`).
- A server-gated, pickup-only `tiffin` outlet type: with the flag off, every path that sets an outlet type to
  `tiffin` is rejected ("Tiffin outlets are not available yet"); an outlet that is already `tiffin` stays editable.
  The onboarding, quick-menu, settings and organization forms offer the type only when the flag is on.

No tiffin routes, booking, ledger or customer features exist.

## Operator notes

- **Do not set `TIFFIN_ENABLED=true` in production before phases 2-3.** With the flag on today, the onboarding
  tile promises "meal boxes for subscribers" (`src/components/onboarding/wizard-steps/step-identity.tsx`), but the
  outlet is only a pickup restaurant.
- Migration 0114's CHECK swap takes an ACCESS EXCLUSIVE lock on `restaurants` and validates the whole table
  (harmless at current size). Ship it through the helper v7 path after a fresh verified backup. The rollback
  order is in the migration 0114 header.

## Obligations for phases 2 and 3

- A combo's currency must equal the outlet's `restaurants.currency`, and the existing "Explicit repricing
  required" guard (migrations 0003/0008/0012) must also cover `tiffin_combos`.
- The database provisioning functions (migrations 0029/0056/0075) pass `request_input->>'outletType'` straight into
  the outlet row, and `outlet_type_valid` now accepts `tiffin`. The application-layer gate
  (`assertOutletTypeAllowed` and the pickup-only check) is therefore the only guard and must stay airtight for
  every new path that can create or change an outlet type.

## Planned phases 1–4

1. **Contracts and foundations:** ADR, outlet type `tiffin` behind `TIFFIN_ENABLED`, schema for plans, combos and slots, with executable rollback. `TIFFIN_ENABLED` defaults to false, so tiffin outlets are unreachable in production until it is enabled.
2. **Weekly menu and combos:** authoring, quotes, public view, date overrides.
3. **Day booking and job cards:** booking with cutoff and cap, orders integration (delivery mode and order-to-slot link land here), the three job-card views, print and share.
4. **Customers, ledger and subscriptions:** owner-managed list, private link, ledger, materialization job, skips, pauses and dues.

### Why delivery mode and the slot link are in phase 3

The spec listed a delivery fulfillment mode and an order-to-slot link in phase 1. Orders are created
inside the SQL function `app_private.submit_guest_order` (redefined in migration 0107), which validates
the mode against `restaurants.fulfillment_modes`; the CHECK `fulfillment_valid` allows only `dine_in`
and `pickup`. Adding either earlier would not be honoured by order creation. Phase 3, where booking
creates orders, changes the function and the constraint in the same migration.

## Rules

- The ledger is a record of what the owner tracks. It is not an invoice, a tax document or a payment.
- Money is never moved by the app: the ledger records payments received outside the app.
- Customer addresses are private customer data: scoped to the outlet, never public, never in logs.
- Entitlements and outlet scope are checked in services, never in the UI.
- Each phase ships only after the previous one passes its acceptance evidence.
