# Tiffin and home-chef hub

Status document for the Tiffin & Home-Chef Hub. Design: [approved spec](superpowers/specs/2026-11-21-tiffin-home-chef-hub-design.md).
Decision: ADR 032 in [decisions](decisions.md). Roadmap context: [product roadmap](product-roadmap.md).

Nothing in this document is deployed. Merging is not deployment; production follows the
[production runbook](production-runbook.md).

## Implemented

None yet. No tiffin tables, routes, flags or outlet type exist in the codebase.

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
