# Tiffin & Home-Chef Hub — Phase 1 (Foundations) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the inert foundations for tiffin outlets: an ADR, a `tiffin` outlet type behind a default-off flag, and empty, tenant-isolated tables for slots, weekly menus, date overrides, combos and delivery areas.

**Architecture:** Additive only. One migration widens `outlet_type_valid` and creates the planning tables with RLS and no direct app-role access (the `crm_guests` pattern, migration `0085`). A new `src/modules/tiffin/contracts.ts` holds constants and Zod schemas. No order, menu or checkout behavior changes, so restaurants are unaffected.

**Tech Stack:** PostgreSQL + Drizzle (hand-written SQL migrations with a journal entry, as `0113`), Zod 4, Vitest, Next.js (read `node_modules/next/dist/docs/` before touching any Next code, per AGENTS.md).

**Spec:** [docs/superpowers/specs/2026-11-21-tiffin-home-chef-hub-design.md](../specs/2026-11-21-tiffin-home-chef-hub-design.md) (approved by the owner 2026-11-21).

## Deviation from the spec, found while planning

The spec lists a `"delivery"` fulfillment mode and an order-to-slot link in phase 1. Orders are created inside the SQL function `app_private.submit_guest_order` (last redefined in migration `0107`) which validates the mode against `restaurants.fulfillment_modes`, itself limited by CHECK `fulfillment_valid` to `dine_in`/`pickup`. Widening that without changing the function would create modes no order can use. **Delivery mode and the slot link therefore move to phase 3**, where booking creates orders and the function changes in the same migration. Phase 1 records this in the ADR. The spec's other phase 1 items are unchanged.

## Global Constraints

- Production is Linux ARM64; no new native dependencies. Do not add npm packages.
- Migrations are append-only, hand-written SQL plus a `_journal.json` entry; never `db:push`, never regenerate migrations to start the app, no destructive SQL.
- Tenant isolation: every new table has `organization_id` and composite foreign keys; RLS enabled; `REVOKE ALL ... FROM PUBLIC,menuminute_app,menuminute_worker` (direct table access closed, as `0085`).
- Money is integer minor units plus the outlet's ISO currency; no floats.
- `scripts/db-seed.ts` stays non-production; the demo tenant is untouched.
- A new outlet/organization-scoped table must be added to `app_private.reset_demo_outlet` or to the preserved list in `tests/demo-reset.test.ts`, which fails otherwise.
- Tiffin remains unreachable in production until `TIFFIN_ENABLED=true`; default `false`.
- Verification before completion: `npm run lint`, `npm run typecheck`, relevant `vitest` files, `npm run build`, `git diff --check`; Markdown formatting for changed docs.

## Review Focus

- Existing restaurant creation and `outlet_type` values keep working; migration idempotent on a database already at `0113`.
- A tiffin outlet request with `TIFFIN_ENABLED` unset is rejected server-side, not merely hidden in the UI.
- A row in organization A cannot reference a slot, combo or area in organization B (composite FKs reject it).
- The app database role cannot `SELECT`/`INSERT` the new tables directly.
- Combo price is non-negative integer minor units; empty or over-long names rejected; duplicate slot kind per outlet rejected.

---

## File Structure

| File                                                                                                                         | Responsibility                                                      |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `docs/decisions.md` (modify)                                                                                                 | ADR for the tiffin module and the delivery deferral                 |
| `docs/tiffin.md` (create)                                                                                                    | Current-status doc: implemented vs planned, links to spec and plans |
| `src/lib/config/env.ts` (modify)                                                                                             | `TIFFIN_ENABLED` flag                                               |
| `src/modules/tiffin/contracts.ts` (create)                                                                                   | Outlet-type constant, slot kinds, Zod schemas for slot/combo/area   |
| `src/db/schema/tiffin.ts` (create) / `index.ts` (modify)                                                                     | Drizzle tables                                                      |
| `src/db/migrations/0114_tiffin_foundation.sql` (create) / `meta/_journal.json` (modify)                                      | Constraint widening + tables + RLS                                  |
| `src/modules/restaurants/service.ts` (modify)                                                                                | Accept `tiffin` only when flag on                                   |
| onboarding/settings/organization UI files                                                                                    | Offer the type only when the flag is on                             |
| `tests/tiffin-contracts.test.ts`, `tests/tiffin-foundation.integration.test.ts`, `tests/tiffin-outlet-type.test.ts` (create) | Proof for each task                                                 |

---

### Task 1: ADR and status doc

**Files:**

- Modify: `docs/decisions.md`
- Create: `docs/tiffin.md`
- Modify: `docs/product-roadmap.md` (add a "Planned: Tiffin & Home-Chef Hub" line linking `tiffin.md`; do not claim it delivered)

**Interfaces:**

- Produces: the ADR number later tasks cite as "ADR tiffin-hub" (use the next free number after the highest row in `docs/decisions.md`; at planning time the highest was 031).

- [ ] **Step 1: Add the ADR row** in the table's existing format: status "Approved 2026-11-21", decision "Tiffin planning layer creates real orders; delivery mode and slot link deferred to phase 3 with the order-function change; outlet type `tiffin` behind `TIFFIN_ENABLED`", and a link to the spec.
- [ ] **Step 2: Write `docs/tiffin.md`** with sections "Implemented" (empty), "Planned phases 1–4" (one line each, from the spec's release order), "Rules" (ledger is a record, not an invoice or payment; addresses are private customer data). Distinguish implemented from planned, per AGENTS.md.
- [ ] **Step 3: Verify.** Run `npx prettier --check docs/decisions.md docs/tiffin.md docs/product-roadmap.md` (if the Tailwind plugin is missing, run `npm ci` first or report the limitation) and `git diff --check`. Expected: clean, and every relative link resolves (`ls` each target).
- [ ] **Step 4: Commit** `docs: record tiffin hub ADR and status`.

---

### Task 2: Feature flag and contracts

**Files:**

- Modify: `src/lib/config/env.ts` near `PUBLIC_DINER_STREAM_ENABLED` (line ~196)
- Create: `src/modules/tiffin/contracts.ts`
- Test: `tests/tiffin-contracts.test.ts`

**Interfaces:**

- Produces from `src/modules/tiffin/contracts.ts`:
  - `export const TIFFIN_OUTLET_TYPE = "tiffin" as const;`
  - `export const SLOT_KINDS = ["lunch", "dinner"] as const; export type SlotKind = (typeof SLOT_KINDS)[number];`
  - `export const slotInputSchema` — `{ kind: SlotKind, startMinute: int 0–1439, endMinute: int 1–1440 > startMinute, cutoffMinutesBefore: int 0–10080, capacity: int ≥1 | null }`
  - `export const comboInputSchema` — `{ name: trimmed string 1–80, description: string ≤300 default "", priceMinor: int 0–2147483647, items: array 1–20 of { label: trimmed 1–80, quantity: int 1–99 }, addons: array 0–20 of { label: trimmed 1–80, priceMinor: int 0–2147483647 } }`
  - `export const areaInputSchema` — `{ name: trimmed string 1–60 }`
  - `export function tiffinEnabled(): boolean` — reads the validated env flag.
- Consumes: the existing env module's `strictBoolean` pattern.

- [ ] **Step 1: Write failing tests** in `tests/tiffin-contracts.test.ts`: `slotInputSchema` rejects `endMinute <= startMinute` and negative capacity and accepts `capacity: null`; `comboInputSchema` rejects `priceMinor: -1`, empty `items`, a 81-char name, and a fractional price (`10.5`); accepts a Veg Thali (`priceMinor: 12000`, items dal×1, sabzi×1, roti×3, rice×1, addon extra roti `1000`); `areaInputSchema` rejects `"  "`.
- [ ] **Step 2: Run** `npx vitest run tests/tiffin-contracts.test.ts`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement** the contracts file and add `TIFFIN_ENABLED: strictBoolean.default(false)` to the env schema.
- [ ] **Step 4: Run** the test again. Expected: PASS. Also run `npm run typecheck`.
- [ ] **Step 5: Commit** `feat(tiffin): add flag and input contracts`.

---

### Task 3: Migration 0114 and Drizzle schema

**Files:**

- Create: `src/db/migrations/0114_tiffin_foundation.sql`
- Modify: `src/db/migrations/meta/_journal.json` (append idx 113, tag `0114_tiffin_foundation`, `when` greater than the last entry, `version "7"`, `breakpoints true`)
- Create: `src/db/schema/tiffin.ts`; Modify: `src/db/schema/index.ts` (`export * from "./tiffin";`)
- Test: `tests/tiffin-foundation.integration.test.ts`

**Interfaces:**

- Produces tables (all with `id text primary key`, `organization_id text not null references organizations(id)`, `outlet_id text not null`, `created_at`/`updated_at timestamptz default clock_timestamp()`, and `UNIQUE (organization_id, id)`; outlet FK is composite `(organization_id, outlet_id) → restaurants(organization_id, id)` if that unique key exists, otherwise add the same cross-tenant guard used by `crm_guest_orders` in `0085`):
  - `tiffin_slots(kind, start_minute, end_minute, cutoff_minutes_before, capacity null, enabled)` with `UNIQUE (outlet_id, kind)` and CHECKs mirroring `slotInputSchema`.
  - `tiffin_week_menus(id, outlet_id, slot_id, weekday smallint 0–6)` unique per `(slot_id, weekday)`.
  - `tiffin_week_menu_combos(week_menu_id, combo_id, sort_order)` primary key `(week_menu_id, combo_id)`.
  - `tiffin_date_overrides(slot_id, local_date date, closed boolean)` unique per `(slot_id, local_date)`; `tiffin_date_override_combos` mirroring the week-menu join.
  - `tiffin_combos(name, description, price_minor bigint check >=0, currency text, archived)`; `tiffin_combo_items(combo_id, label, quantity)`; `tiffin_combo_addons(combo_id, label, price_minor)`.
  - `tiffin_areas(name)` unique per `(outlet_id, lower(name))`.
- Migration also: `ALTER TABLE restaurants DROP CONSTRAINT outlet_type_valid; ADD CONSTRAINT outlet_type_valid CHECK (outlet_type IN ('restaurant','cafe','takeout','cloud_kitchen','hotel','mixed','tiffin'))`. Do **not** touch `fulfillment_valid` or `pickup_only_types`. Header comment states the rollback: re-narrow the CHECK only after confirming no `tiffin` outlets exist; `DROP TABLE` of the `tiffin_*` tables is safe only while empty.
- Every table: `ENABLE ROW LEVEL SECURITY` and `REVOKE ALL ... FROM PUBLIC,menuminute_app,menuminute_worker`.

- [ ] **Step 1: Write failing integration tests** (use `admin`, `fixture` from `tests/helpers.ts`; model on `tests/crm.integration.test.ts`): (a) after `migrateDatabase`, all `tiffin_*` tables exist with `relrowsecurity = true`; (b) as `menuminute_app`, `select 1 from tiffin_slots` fails with a permission error; (c) inserting a restaurant with `outlet_type='tiffin'` succeeds and `'bogus'` is rejected; (d) a combo for org A referencing an outlet of org B is rejected; (e) a second `lunch` slot for the same outlet is rejected; (f) `price_minor = -1` rejected; (g) running `migrateDatabase` twice leaves `drizzle.foundation_migrations` equal to the journal tags (the existing `tests/db-schema-migrations.test.ts` must still pass).
- [ ] **Step 2: Run** `npx vitest run tests/tiffin-foundation.integration.test.ts` (needs the PostgreSQL/Redis integration environment; follow `docs/testing-strategy.md`). Expected: FAIL.
- [ ] **Step 3: Write the migration, journal entry and Drizzle schema.** Match column names and types exactly between SQL and Drizzle.
- [ ] **Step 4: Run** the new test, `tests/db-schema-migrations.test.ts` and `tests/demo-reset.test.ts`. If the demo test fails because the new tables are unlisted, add the `tiffin_*` tables to its preserved list (they are never reset by demo code). Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): add foundation migration 0114 and schema`.

---

### Task 4: Gate the `tiffin` outlet type

**Files:**

- Modify: `src/modules/restaurants/service.ts:72` (add `"tiffin"` to the `outletType` enum)
- Modify: `src/components/onboarding/wizard-types.ts:3`, `src/components/onboarding/wizard-steps/step-identity.tsx`, `src/components/onboarding/quick-menu-identity.tsx`, `src/app/(dashboard)/dashboard/settings/outlet-atelier.tsx`, `src/app/(dashboard)/dashboard/organization/organization-manager.tsx` (offer the type only when the flag is on; pass the flag from a server component as a prop, never read server env in a client component)
- Test: `tests/tiffin-outlet-type.test.ts`

**Interfaces:**

- Consumes: `tiffinEnabled()` and `TIFFIN_OUTLET_TYPE` from Task 2.
- Produces: `createRestaurant(userId, { outletType: "tiffin", ... })` succeeds only when `tiffinEnabled()`; otherwise throws a validation error with message `Tiffin outlets are not available yet`. A tiffin outlet is created with `fulfillmentModes: ["pickup"]` (delivery arrives in phase 3).

- [ ] **Step 1: Write failing tests:** with the flag off, `createRestaurant` with `outletType: "tiffin"` rejects with that message and creates nothing; with the flag on, it creates an outlet with `outletType === "tiffin"` and `fulfillmentModes` `["pickup"]`; `outletType: "restaurant"` is unchanged in both states. Existing `tests/onboarding-lifecycle.test.ts` still passes.
- [ ] **Step 2: Run** `npx vitest run tests/tiffin-outlet-type.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the service check (server-side, before any insert) and default modes; then the UI option, hidden unless enabled. Read the relevant Next docs in `node_modules/next/dist/docs/` before changing server/client boundaries.
- [ ] **Step 4: Run** the new test, `tests/onboarding-lifecycle.test.ts`, `npm run lint`, `npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): gate tiffin outlet type behind TIFFIN_ENABLED`.

---

### Task 5: Whole-slice verification and PR update

**Files:** none new.

- [ ] **Step 1: Run** `npm run lint`, `npm run typecheck`, `npx vitest run tests/tiffin-contracts.test.ts tests/tiffin-foundation.integration.test.ts tests/tiffin-outlet-type.test.ts tests/db-schema-migrations.test.ts tests/demo-reset.test.ts tests/onboarding-lifecycle.test.ts`, `npm run build`, and `git diff --check`. Expected: all pass. Record exact commands and results; report any baseline failure separately.
- [ ] **Step 2: Confirm inertness:** with `TIFFIN_ENABLED` unset, grep the diff for any change to `submit_guest_order`, `orderSubmissionSchema`, menu publishing or checkout; expected none.
- [ ] **Step 3: Push and open a draft PR** for the phase 1 branch, filling the repository PR template (Outcome, Contract and ownership, Correctness and recovery with the migration rollback note, Evidence with the commands above, Delivery: merge is not a deployment and the flag stays off).

---

## Self-Review

- **Spec coverage (phase 1):** ADR (Task 1), outlet type (Tasks 3–4), schema for slots/weekly menus/combos (Task 3), executable rollback note (Task 3), tenant isolation tests (Task 3). Delivery mode and order slot link are explicitly moved to phase 3 (see Deviation). Customers, bookings, subscriptions, ledger and job cards belong to phases 3–4 and are deliberately absent.
- **Type consistency:** `SlotKind`, schema names and column names in Task 3 mirror Task 2's schemas; `tiffinEnabled()` is defined in Task 2 and consumed in Task 4.
- **Unverified at planning time (implementer must check first):** the exact RLS/`can_outlet` helper signatures if later phases add definer functions; the ADR number; whether `npm ci` provides Prettier's Tailwind plugin for the docs check.
