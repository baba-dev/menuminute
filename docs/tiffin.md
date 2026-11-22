# Tiffin and home-chef hub

Status document for the Tiffin & Home-Chef Hub. Design: [approved spec](superpowers/specs/2026-11-21-tiffin-home-chef-hub-design.md).
Decision: ADR 032 in [decisions](decisions.md). Roadmap context: [product roadmap](product-roadmap.md).

Nothing in this document is deployed. Merging is not deployment; production follows the
[production runbook](production-runbook.md).

## Implemented

Phases 1 and 2 exist in the codebase behind `TIFFIN_ENABLED` (default false). Nothing is deployed and the feature is not
generally available. Merging is not deployment.

### Phase 1: foundations

- Migration 0114: `outlet_type_valid` widened to allow `tiffin`, plus nine RLS-locked `tiffin_*` tables
  (slots, combos with items and add-ons, week menus, date overrides, areas). Direct access is revoked from
  `menuminute_app` and `menuminute_worker`.
- The `TIFFIN_ENABLED` flag and `src/modules/tiffin/contracts.ts` (input schemas, `tiffinEnabled()`).
- A server-gated, pickup-only `tiffin` outlet type: with the flag off, every path that sets an outlet type to
  `tiffin` is rejected ("Tiffin outlets are not available yet"); an outlet that is already `tiffin` stays editable.
  The onboarding, quick-menu, settings and organization forms offer the type only when the flag is on.

### Phase 2: weekly menus, combos, public view, date overrides, quote

- **Pricing and contracts:** `src/modules/tiffin/pricing.ts` (checked integer money, no client prices) and the phase 2
  input schemas in `src/modules/tiffin/contracts.ts`.
- **Migration 0115 (authoring):** guarded `SECURITY DEFINER` authoring functions for slots, combos (with items and
  add-ons), week menus and date overrides, audit rows for every edit, the currency guard trigger on `tiffin_combos`
  and the 200 non-archived combos per outlet bound.
- **Migration 0116 (public read):** `tiffin_public_week` and `tiffin_public_offer`, plus owner-only clock-injected
  test-support variants (`tiffin_public_week_at`, `tiffin_public_offer_at`) that the app and worker roles cannot execute.
- **Service and routes:** `src/modules/tiffin/service.ts`. Authoring routes live under `/api/tiffin/[outletId]/...`
  (session and outlet scope checked in the service). Public routes live under `/api/public-tiffin/[publicMenuId]/...`:
  the public week (GET) and the quote (POST). With the flag off or malformed, every tiffin route answers a plain 404.
- **Rate limits** (`src/modules/tiffin/rate-limit.ts`, Redis, fail closed with 503, 60 second windows; runs before the body is read):
  per verified source `TIFFIN_SOURCE_LIMIT` week 60, quote 30; per source and token `TIFFIN_SOURCE_TOKEN_LIMIT`
  week 40, quote 20; per token across sources `TIFFIN_TOKEN_LIMIT` 2000; global `TIFFIN_GLOBAL_LIMIT` week 3000,
  quote 1500. The global cap is the PostgreSQL protection; the token cap only bounds key growth.
- **Dashboard:** `/dashboard/tiffin` pages for combos and the weekly menu (week grid, slot settings, date overrides),
  with a navigation entry shown only for tiffin outlets while the flag is on.
- **Public weekly menu:** `/m/<publicMenuId>/week` (`src/components/tiffin/public-week.tsx`). For a tiffin outlet with
  the flag on, `/m/<publicMenuId>` redirects to the week page (the redirect drops `?lang`). The page says
  "Booking opens soon"; there is no booking.
- **Quote:** a pre-tax, server-priced command (`POST /api/public-tiffin/[publicMenuId]/quote`). It has no customer
  quote UI and creates no order.

### Rules decided in phase 2

- Edits take effect immediately and are audited. Last write wins per outlet (advisory lock).
- A date override replaces that day's menu; a closed override means nothing is offered that day.
- Weekday convention: 0 = Sunday.
- Archived combos are never offered or quoted and keep their stored currency.
- The combo currency is set by the server from the outlet. A currency change is blocked while a non-archived combo
  has a different currency.
- 200 non-archived combos per outlet is an abuse bound, not a plan limit.
- Cutoff and capacity are stored but neither editable nor enforced until phase 3.
- `tiffin_public_offer` returns an empty combo list for a valid tiffin token when nothing is offered, and for an
  out-of-window date, whereas `tiffin_public_week` returns NULL out of window. Both return NULL for an invalid token
  or non-tiffin outlet.

No booking, orders integration, job cards, customer list, ledger or subscription exists.

## Operator notes

- **Keep `TIFFIN_ENABLED` off in production until phase 3 completes booking.** With the flag on, the onboarding
  tile promises "meal boxes for subscribers" (`src/components/onboarding/wizard-steps/step-identity.tsx`) and the
  public pages say "Booking opens soon", but nothing can be booked.
- **Live Nginx needs a new block before the flag is ever turned on.** Without
  `location /api/public-tiffin`, both public routes answer 503 because `verifiedOrderSource` cannot attest the
  client. This is an operator action done outside the repository: add the block inside the
  `food.bababuilds.com` server block next to `/api/public-orders` (plain prefix, not `^~`), run `nginx -t`, reload,
  and capture ERP HTTP 200 before and after. The reviewed example is in `infra/nginx/menuminute.conf.example`.

  ```nginx
  location /api/public-tiffin {
      include /etc/menuminute/nginx-order-edge-secret.conf;
      proxy_pass http://127.0.0.1:3100;
      proxy_http_version 1.1;
      proxy_set_header Host $host;
      proxy_set_header X-Forwarded-Proto $scheme;
      proxy_set_header X-Forwarded-For $remote_addr;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-MenuMinute-Client-IP $remote_addr;
      proxy_set_header X-MenuMinute-Edge-Key $menuminute_edge_secret;
      proxy_read_timeout 30s;
      client_max_body_size 16k;
      proxy_hide_header Cache-Control;
      add_header Cache-Control "private, no-store" always;
  }
  ```

  `scripts/security/verify-live-edge.mjs` was intentionally not changed; add the new prefix there only once the live
  host has the block. `scripts/security/verify-api-boundaries.mjs` checks the example config.

- Migration 0114's CHECK swap takes an ACCESS EXCLUSIVE lock on `restaurants` and validates the whole table
  (harmless at current size). Ship it through the helper v7 path after a fresh verified backup. The rollback
  order is in the migration 0114 header.
- Migrations 0115 and 0116 are additive. Ship them through the helper v7 path after a fresh verified backup.
  Rollback: drop the two migrations' functions and the currency trigger; data stays in the phase 1 tables, which
  roll back per the 0114 header. 0116 includes owner-only test-support functions (`tiffin_public_week_at`,
  `tiffin_public_offer_at`) that the app and worker roles cannot execute.
- Follow-up, not fixed: the public rate limits key on the exact source address, so an IPv6 /64 supplies unlimited
  sources. The orders limiter has the same gap; aggregating by /64 is a recorded follow-up.

## Obligations for phases 2 and 3

- **Enforced by migration 0115:** a combo's currency equals the outlet's `restaurants.currency` (set by the server,
  guarded by a trigger), and the "Explicit repricing required" guard also covers `tiffin_combos`.
- The database provisioning functions (migrations 0029/0056/0075) pass `request_input->>'outletType'` straight into
  the outlet row, and `outlet_type_valid` now accepts `tiffin`. The application-layer gate
  (`assertOutletTypeAllowed` and the pickup-only check) is therefore the only guard and must stay airtight for
  every new path that can create or change an outlet type.
- **Owner decision open:** whether combos count against the Free plan's 20-dish cap. Not implemented; the
  200-combo bound is not a plan limit.

## Planned phases 1–4

1. **Contracts and foundations (implemented):** ADR, outlet type `tiffin` behind `TIFFIN_ENABLED`, schema for plans, combos and slots, with executable rollback. `TIFFIN_ENABLED` defaults to false, so tiffin outlets are unreachable in production until it is enabled.
2. **Weekly menu and combos (implemented, behind the flag):** authoring, quotes, public view, date overrides.
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
