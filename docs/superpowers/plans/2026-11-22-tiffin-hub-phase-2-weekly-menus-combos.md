# Tiffin & Home-Chef Hub — Phase 2 (Weekly Menus & Combos) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tiffin owner can author combos, a lunch/dinner weekly menu and per-date overrides; guests can see the weekly menu through the outlet's permanent QR link; the server can produce an authoritative pre-tax quote for a selection of combos and add-ons. No booking, cutoff, capacity or order yet (phase 3).

**Architecture:** The nine phase 1 `tiffin_*` tables stay closed to `menuminute_app`; all access goes through `SECURITY DEFINER` functions in `app_private` (the `0085_guest_crm` pattern) called from a thin `src/modules/tiffin/service.ts` inside `withOutlet`. One migration (`0115`) adds the functions, audit writes, a combo-currency guard and a combo cap. Pricing is a pure TypeScript module over `bigint`. The public week is read by QR token (as `app_private.free_menu_public` does) and is never cached in Redis.

**Tech Stack:** PostgreSQL + Drizzle (hand-written SQL), Zod 4, Vitest, Next.js (read `node_modules/next/dist/docs/` before touching routes, pages or server/client boundaries, per AGENTS.md).

**Spec:** [docs/superpowers/specs/2026-11-21-tiffin-home-chef-hub-design.md](../specs/2026-11-21-tiffin-home-chef-hub-design.md), phase 2 of its Release order. Phase 1: [plan](2026-11-21-tiffin-hub-phase-1-foundations.md), merged as PR #362 (migration `0114`, flag, gated outlet type).

## Global Constraints

- Everything is unreachable unless `TIFFIN_ENABLED=true` **and** the outlet's `outlet_type = 'tiffin'`. With the flag off: authoring commands reject, the public week and quote return not-found. Responses must not reveal whether an outlet is tiffin.
- Migrations are append-only, hand-written SQL plus a `_journal.json` entry (next idx 114, tag `0115_tiffin_menu_commands`); never edit `0001`–`0114`; no `db:push`.
- Tenant isolation: every function checks current membership and outlet scope via `app_private.can_outlet(outlet, 'menu.read' | 'menu.write')` and `current_setting('app.outlet_id')`; a client outlet ID is a selector, never proof of access. Child rows keep the phase 1 3-column composite FKs.
- Roles (product requirements): owner, org admin, outlet manager and menu editor may author; service/kitchen staff may only read.
- Money: integer minor units (`bigint` in SQL, `bigint` in TS); no floats; a combo's currency always equals `restaurants.currency` and is set by the server, never by the client.
- Server prices are authoritative; the quote re-reads the live menu. Quotes are pre-tax (as `src/modules/orders/quote.ts`); no tax, discount or payment logic.
- Public reads are dynamic, `no-store`, PostgreSQL-authoritative (QR revocation, outlet publication, org status checked per request). No Redis caching of the tiffin week.
- Public routes follow `src/app/api/public-orders/route.ts`: origin check, JSON content-type, `boundedBytes` body (never `await req.json()`; `scripts/security/verify-api-boundaries.mjs` enforces it), per-source rate limit.
- Weekday convention is PostgreSQL `EXTRACT(DOW)`: `0 = Sunday … 6 = Saturday`. Dates are outlet-local calendar dates (`restaurants.timezone`), resolved in SQL.
- No new npm packages; Linux ARM64 only; no secrets; the demo tenant is untouched (new tiffin tables stay on the preserved list in `tests/demo-reset.test.ts`).
- Verification before completion: `pnpm lint`, `pnpm typecheck`, the task's vitest files, `pnpm build` for UI tasks, `git diff --check`, Prettier on changed Markdown.

## Decisions made in this plan (owner can overrule; each is a ruling to record)

- **Edits take effect immediately** (no draft/publish layer for tiffin menus). Every write is audited in `audit_logs`. Cost if wrong: add a draft layer later; weekly menus are low-risk compared with ordering.
- **Last write wins, serialized per outlet** with `pg_advisory_xact_lock`; no revision column. Cost if wrong: a lost update between two simultaneous editors.
- **A date override replaces that day's menu for its slot:** `closed = true` offers nothing; `closed = false` offers exactly its combos (possibly none). No override means the weekday menu.
- **Archived combos are never offered or quoted** but keep their stored currency as history. Changing an outlet's currency is blocked while any non-archived combo has a different currency (same "Explicit repricing required" rule the menu uses).
- **Combo cap per outlet: 200 non-archived** is an abuse bound, not a plan limit. Whether combos count against the Free plan's 20-dish cap is still an open owner decision and is **not implemented here**.
- **No customer-facing quote UI.** The quote is a server command and route consumed by phase 3 booking. The public page lists the week with prices and says booking is not open yet.

## Review Focus

- Flag off, or outlet not tiffin: authoring, public week and quote behave as if the feature does not exist (no tenant-type leak).
- A combo or slot from outlet/org A can never appear in outlet/org B's week menu or override (3-column composite FKs reject it).
- Archived combo, closed day, disabled slot, or combo not on that day's menu: quote rejects it; changing a price after the guest viewed the page makes the quote use the new price.
- Local date near midnight and across DST in the outlet timezone resolves to the correct weekday.
- Huge quantity, negative or fractional quantity, 101 lines, duplicate add-on ids, add-on from another combo: rejected with a clear validation error and no overflow.
- Revoked QR or unpublished outlet: public week is not found.
- Two editors saving the same combo or week simultaneously never leave a half-written combo (items/add-ons are replaced atomically).

---

## File Structure

| File                                                                                              | Responsibility                                                            |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/modules/tiffin/pricing.ts` (create)                                                          | Pure `bigint` line and selection pricing                                  |
| `src/modules/tiffin/contracts.ts` (modify)                                                        | Input schemas for combo save, week set, override set, quote; output types |
| `src/db/migrations/0115_tiffin_menu_commands.sql` (create) / `meta/_journal.json` (modify)        | Definer functions, audit, currency guard, combo cap                       |
| `src/modules/tiffin/service.ts` (create)                                                          | `withOutlet` wrappers, flag gate, error mapping; `publicWeek`, `quote`    |
| `src/app/api/tiffin/**/route.ts`, `src/app/api/public-tiffin/[publicMenuId]/**/route.ts` (create) | Thin routes                                                               |
| `src/app/(dashboard)/dashboard/tiffin/**` (create), `src/modules/dashboard/nav-model.ts` (modify) | Owner UI                                                                  |
| `src/app/(public-menu)/m/[publicMenuId]/week/page.tsx` (create), `.../page.tsx` (modify)          | Public weekly menu                                                        |
| `tests/tiffin-*.test.ts` (create)                                                                 | Proof per task                                                            |

---

### Task 1: Pricing module, input contracts, phase 1 carry-over

**Files:**

- Create: `src/modules/tiffin/pricing.ts`
- Modify: `src/modules/tiffin/contracts.ts`, `src/lib/config/env.ts` (only if needed for the flag parse below)
- Test: `tests/tiffin-pricing.test.ts`, `tests/tiffin-contracts.test.ts` (extend)

**Interfaces:**

- Produces from `pricing.ts`:
  - `export type PricedCombo = { id: string; name: string; priceMinor: bigint; addons: { id: string; label: string; priceMinor: bigint }[] }`
  - `export type SelectionLine = { comboId: string; addonIds: string[]; quantity: number }`
  - `export type QuotedLine = { comboId: string; name: string; unitMinor: bigint; addons: { id: string; label: string; priceMinor: bigint }[]; quantity: number; lineMinor: bigint }`
  - `export function priceLine(combo: PricedCombo, line: SelectionLine): QuotedLine` — `unitMinor = combo.priceMinor + sum(addon prices)`, `lineMinor = unitMinor × quantity`; throws `ValidationError` for duplicate/unknown add-on ids, non-integer or non-positive quantity, or a result above `2n**63n - 1n`.
  - `export function priceSelection(combos: readonly PricedCombo[], lines: readonly SelectionLine[]): { lines: QuotedLine[]; totalMinor: bigint }` — 1–100 lines, rejects unknown combo ids, checked total.
- Produces from `contracts.ts` (Zod, `.strict()`): `comboSaveSchema` (`id` optional, plus the phase 1 `comboInputSchema` fields), `weekSetSchema` (`slotKind`, `weekday` 0–6, `comboIds` unique, max 50), `overrideSetSchema` (`slotKind`, `localDate` `YYYY-MM-DD`, `closed`, `comboIds` unique max 50), `quoteInputSchema` (`localDate`, `slotKind`, `lines` 1–100 `{comboId, addonIds ≤ 20, quantity}`), and `tiffinFlagEnabled(): boolean` that parses only `TIFFIN_ENABLED` (same fail-closed result as today, without parsing the whole environment).
- Consumes: `ValidationError` from `src/lib/errors`.

- [ ] **Step 1: Write failing tests** in `tests/tiffin-pricing.test.ts` with these worked examples (INR minor units): Veg Thali `12000` with add-on extra roti `1000`, quantity `3`, one add-on → `unitMinor 13000n`, `lineMinor 39000n`; same combo, no add-ons, quantity `2` → `24000n`; a two-line selection (39000 + a second combo `8000` × `1`) → `totalMinor 47000n`; quantity `0`, `-1`, `1.5` rejected; add-on id listed twice rejected; add-on id not on the combo rejected; `2147483647n × 2147483647` quantity stays exact (no float rounding); a product above `2n**63n - 1n` rejected; 101 lines rejected. Add contract tests for each new schema (unique `comboIds`, bad date `2026-02-30`, `weekday: 7`, unknown key).
- [ ] **Step 2: Run** `pnpm exec vitest run tests/tiffin-pricing.test.ts tests/tiffin-contracts.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the pricing functions and schemas per the signatures above; pure functions, no I/O. Make `tiffinFlagEnabled()` parse `process.env["TIFFIN_ENABLED"]` with the same `"true"/"false"` semantics as `strictBoolean`, throwing on any other set value; keep `tiffinEnabled()` working, delegating to it (phase 1 minor: stops re-parsing the whole environment per page render).
- [ ] **Step 4: Add the phase 1 deferred boundary tests** to `tests/tiffin-contracts.test.ts`: 80-char name accepted and 81 rejected; 20 items accepted and 21 rejected; 20 add-ons accepted and 21 rejected; quantity `0` and `100` rejected, `99` accepted; `startMinute: 1440` rejected; `priceMinor` `2147483647` accepted and `2147483648` rejected; whitespace-only name rejected.
- [ ] **Step 5: Run** the two files plus `pnpm typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(tiffin): add pricing module and phase 2 input contracts`.

---

### Task 2: Migration 0115 — guarded access functions

**Files:**

- Create: `src/db/migrations/0115_tiffin_menu_commands.sql`
- Modify: `src/db/migrations/meta/_journal.json` (idx 114, tag `0115_tiffin_menu_commands`, `when` greater than the previous entry, version `"7"`, breakpoints `true`)
- Test: `tests/tiffin-menu-commands.integration.test.ts`

**Interfaces:** all functions are `SECURITY DEFINER SET search_path=pg_catalog,public,pg_temp`, `REVOKE ALL … FROM PUBLIC`, `GRANT EXECUTE … TO menuminute_app` only.

- `app_private.tiffin_can(p_outlet text, p_mode text) RETURNS boolean` — true only if the outlet is active, in an active organization, `outlet_type = 'tiffin'`, `current_setting('app.outlet_id',true) = p_outlet`, and `app_private.can_outlet(p_outlet, CASE p_mode WHEN 'write' THEN 'menu.write' ELSE 'menu.read' END)`.
- `app_private.tiffin_slot_save(p_outlet text, p jsonb) RETURNS jsonb` — upserts the outlet's `lunch` or `dinner` slot (`startMinute`, `endMinute`, `cutoffMinutesBefore`, `capacity`, `enabled`).
- `app_private.tiffin_combo_save(p_outlet text, p jsonb) RETURNS jsonb` — creates or updates a combo; replaces its items and add-ons atomically; sets `currency` from `restaurants.currency`; rejects a 201st non-archived combo (`ERRCODE '54000'`); `p ? 'archived'` archives or restores.
- `app_private.tiffin_week_set(p_outlet text, p jsonb) RETURNS jsonb` and `app_private.tiffin_override_set(p_outlet text, p jsonb) RETURNS jsonb` (also clears an override when `p->>'clear' = 'true'`); both verify every combo id belongs to the same outlet and is not archived.
- `app_private.tiffin_menu_read(p_outlet text) RETURNS jsonb` — slots, non-archived combos (with items and add-ons), week entries, overrides from today minus 1 day forward.
- Every write function takes `pg_advisory_xact_lock(hashtextextended('tiffin:'||p_outlet,0))` first and inserts an `audit_logs` row (`action`, `resource_type = 'tiffin_*'`, `before`, `after`, `user_id = current_setting('app.actor_id')`).
- A `BEFORE UPDATE OF currency ON restaurants` trigger function raises `'Explicit repricing required'` (`ERRCODE '22023'`) when the currency changes and any non-archived `tiffin_combos` row for that outlet has a different currency. Existing `manage_organization` functions are **not** redefined.

- [ ] **Step 1: Write failing integration tests** (pattern: `tests/tiffin-foundation.integration.test.ts`, `tests/helpers.ts` `fixture`/`admin`; make the fixture outlet tiffin with `update restaurants set outlet_type='tiffin'` via `admin`, call functions through the app role inside `withOutlet`): owner saves a combo and reads it back with currency equal to the outlet's; a menu editor and a manager can write; a service-staff or kitchen member can read but not write (expect `ForbiddenError`/false); a non-tiffin (`restaurant`) outlet gets `tiffin_can` false; a user from another organization is denied; a combo from outlet A in outlet B's week is rejected; an archived combo in a week is rejected; the 201st combo is rejected with SQLSTATE `54000` and archiving one frees a slot; saving a combo twice concurrently (two connections) leaves exactly one coherent item list; changing the outlet currency with a live combo raises `22023`, and succeeds when all combos are archived; every write produced an `audit_logs` row; a second `migrateDatabase` leaves `drizzle.foundation_migrations` equal to the journal; the nine phase 1 tables are still directly inaccessible to `menuminute_app` and `menuminute_worker` (`42501`).
- [ ] **Step 2: Run** the file. Expected: FAIL (functions missing).
- [ ] **Step 3: Write the migration** and journal entry. Header comment states the rollback: drop the triggers and functions (data stays in the phase 1 tables; the tables are rolled back per the `0114` header). Follow `0085_guest_crm.sql` and `0107_live_sales_tax.sql` style for definer functions and `GRANT`s.
- [ ] **Step 4: Run** the new file, `tests/tiffin-foundation.integration.test.ts`, `tests/demo-reset.test.ts`, `tests/db-schema-migrations.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): add menu command functions and currency guard (migration 0115)`.

---

### Task 3: Service, public week and quote

**Files:**

- Create: `src/modules/tiffin/service.ts`
- Modify: migration `0115` is **closed**; add the public functions in a new migration `src/db/migrations/0116_tiffin_public_week.sql` with its journal entry
- Test: `tests/tiffin-service.integration.test.ts`

**Interfaces:**

- Consumes: Task 1 schemas and `priceSelection`; Task 2 functions; `withOutlet`, `Actor` from `src/modules/tenancy/service`; `tiffinFlagEnabled` from Task 1.
- Produces (`service.ts`; all reject with `NotFoundError` when `!tiffinFlagEnabled()`; authoring calls run inside `withOutlet(actor, outletId, "menu.write" | "menu.read", …)`):
  - `export async function readTiffinMenu(actor: Actor, outletId: string): Promise<TiffinMenu>`
  - `export async function saveCombo(actor: Actor, outletId: string, raw: unknown)`, `saveSlot`, `setWeekMenu`, `setOverride` — each parses with the Task 1 schema first, then calls the matching function.
  - `export async function publicWeek(token: string, fromDate?: string, days?: number): Promise<PublicWeek | null>` — `days` 1–14 (default 7); `null` for unknown token, revoked QR, unpublished outlet, inactive organization, non-tiffin outlet or flag off.
  - `export async function quoteSelection(token: string, raw: unknown): Promise<TiffinQuote>` where `TiffinQuote = { outletId: string; currency: string; localDate: string; slotKind: SlotKind; lines: QuotedLine[]; totalMinor: string }` (`totalMinor` serialized as a decimal string; `bigint` never goes through JSON as a number).
- Migration `0116` adds `app_private.tiffin_public_week(p_token text, p_from date, p_days integer) RETURNS jsonb` and `app_private.tiffin_public_offer(p_token text, p_date date, p_slot text) RETURNS jsonb` (granted to `menuminute_app`). Both resolve the token exactly as `app_private.free_menu_public` does (`qr_codes.destination_token`, `is_active`, outlet `is_active` and `is_published`, organization active) plus `outlet_type = 'tiffin'`, compute the outlet-local date with `restaurants.timezone`, and apply the override-replaces-day rule from the decisions above. `tiffin_public_offer` returns the offered combos (with add-ons and the outlet currency) for one date and slot, or `null`.

- [ ] **Step 1: Write failing tests** (real PostgreSQL): `publicWeek` returns the seeded weekday menu in order; a closed override hides that day; an override with combos replaces the weekday menu; an archived combo and a disabled slot are absent; a revoked QR token (use the existing QR revoke helper or `admin` SQL), an unpublished outlet, a `restaurant` outlet and the flag off (`vi.stubEnv`) all return `null`; the date `2026-03-29` for an `Europe/London` outlet and `2026-11-01` for `America/New_York` resolve to the correct weekday (outlet-local, not UTC); `quoteSelection` returns the Task 1 worked totals as a string; raising a combo price between two calls changes the second quote; a combo not offered that day, an archived combo, an add-on from another combo, quantity `0` and 101 lines are rejected with `ValidationError`; the authoring functions reject a service-staff actor.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/tiffin-service.integration.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** migration `0116`, journal entry and `service.ts`. Map SQLSTATE `54000` to a `ValidationError("You have reached the combo limit")` and `22023` to a validation error with the function's message; never leak other database errors.
- [ ] **Step 4: Run** the new file, `tests/tiffin-menu-commands.integration.test.ts`, `tests/db-schema-migrations.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): add tiffin service, public week and quote`.

---

### Task 4: HTTP routes

**Files:**

- Create: `src/app/api/tiffin/[outletId]/menu/route.ts` (GET, PUT week/override/slot via a `kind` field in a Zod discriminated union), `src/app/api/tiffin/[outletId]/combos/route.ts` (POST/PATCH), `src/app/api/public-tiffin/[publicMenuId]/week/route.ts` (GET), `src/app/api/public-tiffin/[publicMenuId]/quote/route.ts` (POST)
- Test: `tests/tiffin-routes.test.ts`

**Interfaces:**

- Consumes: Task 3 service functions. Dashboard routes follow the session/actor and error handling of the neighbouring `src/app/api/menu/**` routes; public routes follow `src/app/api/public-orders/route.ts` (origin check for POST, JSON content-type, `boundedBytes` with a 16 KiB limit, a new `reserveTiffinQuoteSource` rate limit modelled on `src/modules/orders/rate-limit.ts` with the same verified-source rule, `no-store`).
- Produces: JSON routes that return the service types; errors via `errorResponse` with stable codes; `404` for every not-found case including flag off.

- [ ] **Step 1: Write failing route tests** (pattern: `tests/online-ordering.test.ts`, `tests/order-bounded-input.test.ts`): wrong origin → 403; non-JSON → 415; oversized body → 413; rate-limit exhaustion → 429; flag off → 404 on all four routes; an unauthenticated dashboard request → 401 and a cross-organization outlet id → 403/404 with no existence leak; valid quote → 200 with the Task 3 shape.
- [ ] **Step 2: Run** `pnpm exec vitest run tests/tiffin-routes.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** the routes as thin wrappers (no business logic) and the rate-limit helper.
- [ ] **Step 4: Run** the new file, `node scripts/security/verify-api-boundaries.mjs` (expected exit 0) and `pnpm typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): add authoring and public quote routes`.

---

### Task 5: Dashboard — combos

**Files:**

- Create: `src/app/(dashboard)/dashboard/tiffin/page.tsx`, `src/app/(dashboard)/dashboard/tiffin/combos/page.tsx`, a client component `combo-editor.tsx` in the same folder
- Modify: `src/modules/dashboard/nav-model.ts` (add `"tiffin"` to `NavId`, shown only when the selected outlet is tiffin **and** `tiffinFlagEnabled()`; the flag is computed in a server component and passed to the nav model as data), the nav icon list
- Test: `tests/tiffin-dashboard-nav.test.ts`, `tests/e2e/tiffin-combos.spec.ts` (only if `tests/e2e` already has a dashboard-page pattern to follow; otherwise component tests)

**Interfaces:** consumes Task 3 `readTiffinMenu` and Task 4 routes. Produces the combo list (name, price formatted with the outlet's currency exponent via `src/lib/money.ts`, items, add-ons, archive/restore) and a create/edit form with the Task 1 bounds as client-side hints only (server is authoritative). Required states: loading, empty ("No combos yet"), error, saving, archived filter. Keyboard-operable, labelled controls, mobile layout; reuse existing design components (read `docs/design-system.md` first). No server env in client components.

- [ ] **Step 1: Write failing tests:** nav model shows the Tiffin entry only for a tiffin outlet with the flag on (off → absent for a tiffin outlet; never present for restaurants); every existing nav test still passes.
- [ ] **Step 2: Run** the nav test. Expected: FAIL.
- [ ] **Step 3: Implement** the nav change, pages and editor. Read the relevant guide in `node_modules/next/dist/docs/` before writing server/client components.
- [ ] **Step 4: Run** nav tests, `tests/dashboard-*` tests that reference the nav, `pnpm lint`, `pnpm typecheck`, `pnpm build`, and (if added) the Playwright spec with `--trace off`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): add combo management to the dashboard`.

---

### Task 6: Dashboard — weekly menu and date overrides

**Files:**

- Create: `src/app/(dashboard)/dashboard/tiffin/week/page.tsx`, `week-editor.tsx`, `overrides-editor.tsx`
- Test: extend `tests/tiffin-dashboard-nav.test.ts` or add `tests/tiffin-week-editor.test.tsx` following the existing `*.test.tsx` component-test pattern

**Interfaces:** consumes Task 3 `readTiffinMenu`/`setWeekMenu`/`setOverride`/`saveSlot` via Task 4 routes. Produces a 7-day × lunch/dinner grid where each cell is an ordered list of combos (add/remove/reorder), a slot settings panel (window, enabled; cutoff and capacity are shown as "used in a later phase" and not editable), and a date-override list (pick a date within the next 366 days: close the day, or replace its combos; clear an override). Required states as Task 5; day names follow the weekday convention above and are localized with `Intl`.

- [ ] **Step 1: Write failing component tests:** the grid renders seven days in locale order mapped to `0 = Sunday … 6 = Saturday`; adding a combo to Monday lunch calls the week route with `weekday: 1`; archived combos are not selectable; an override date outside the window is rejected in the UI and by the server.
- [ ] **Step 2: Run** the tests. Expected: FAIL.
- [ ] **Step 3: Implement** the editors.
- [ ] **Step 4: Run** the tests, `pnpm lint`, `pnpm typecheck`, `pnpm build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): add weekly menu and date override editors`.

---

### Task 7: Public weekly menu

**Files:**

- Create: `src/app/(public-menu)/m/[publicMenuId]/week/page.tsx`, a presentational `src/components/tiffin/public-week.tsx`
- Modify: `src/app/(public-menu)/m/[publicMenuId]/page.tsx` (only the minimal branch: for a tiffin outlet with the flag on, redirect to `…/week`; every other outlet renders exactly as before)
- Test: `tests/tiffin-public-week.test.tsx`

**Interfaces:** consumes Task 3 `publicWeek`. Produces a server-rendered, `dynamic = "force-dynamic"` page (same reasons as the existing page) showing the next 7 outlet-local days, each with lunch and dinner combos (name, items, add-ons, price in the outlet currency), the outlet name, and a clear notice "Booking opens soon"; `notFound()` when `publicWeek` is `null`. Honest copy only: no promise of delivery, subscriptions or availability beyond what the owner entered; no allergen or dietary claims.

- [ ] **Step 1: Write failing tests:** a seeded week renders combos for each day; a closed day shows "Closed"; flag off or a non-tiffin outlet → `notFound`; the restaurant page output is unchanged (snapshot of an existing page test, or a render assertion that a restaurant outlet is not redirected).
- [ ] **Step 2: Run** `pnpm exec vitest run tests/tiffin-public-week.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the page and component; reuse the existing public-menu styles and `admitPublicMenuRender()` admission control as the current page does.
- [ ] **Step 4: Run** the new test, the existing public-menu tests (`tests/public-*`), `pnpm lint`, `pnpm typecheck`, `pnpm build`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(tiffin): add the public weekly menu page`.

---

### Task 8: Whole-slice verification and docs

**Files:** `docs/tiffin.md`, `docs/decisions.md` (record the phase 2 rulings above in the ADR 032 section), `docs/product-roadmap.md` (planned line only).

- [ ] **Step 1: Update** `docs/tiffin.md` "Implemented" with the phase 2 pieces and the combo-currency obligation now enforced; keep "Planned" for phases 3–4; restate the operator note that `TIFFIN_ENABLED` must stay off in production until phase 3 completes booking. Record the owner-open item (combos vs the Free dish cap).
- [ ] **Step 2: Run** `pnpm lint`, `pnpm typecheck`, `pnpm exec vitest run` for every `tests/tiffin-*` file plus `tests/db-schema-migrations.test.ts`, `tests/demo-reset.test.ts`, `tests/onboarding-lifecycle.test.ts`, `pnpm build`, `node scripts/security/verify-api-boundaries.mjs`, `git diff --check`, and Prettier on changed Markdown. Expected: all pass; report any failure that also fails on the base commit separately.
- [ ] **Step 3: Inertness check:** with `TIFFIN_ENABLED` unset, grep the diff for any change to `submit_guest_order`, `orderSubmissionSchema`, `src/modules/orders/**`, the menu publishing path (`src/modules/menu-product/**`, `src/modules/menus/**`) and migrations `0001`–`0114`; expected none (the `[publicMenuId]/page.tsx` branch is the only shared-file edit and is flag-gated).
- [ ] **Step 4: Push** the branch and open a draft PR filling the repository template (Outcome, Contract and ownership, Correctness and recovery with the 0115/0116 rollback notes, Evidence with exact commands, Delivery: merge is not a deployment; flag stays off).

---

## Self-Review

- **Spec coverage (phase 2 "authoring, quotes, public view, date overrides"):** authoring (Tasks 2–6), quotes (Tasks 1 and 3–4), public view (Tasks 3 and 7), date overrides (Tasks 2, 3, 6). Phase 1 carry-over: combo currency obligation (Task 2 trigger and server-set currency), provisioning-gate obligation stays satisfied (no new path sets `outlet_type`), flag-parse and boundary-test minors (Task 1). Combos vs Free dish cap is explicitly not implemented.
- **Step scan:** each step names its tests with assertions or its signatures and the files; UI tasks leave layout to the implementer inside the stated required states.
- **Type consistency:** `QuotedLine`, `PricedCombo`, `SelectionLine` (Task 1) are consumed unchanged by `quoteSelection` (Task 3); `SlotKind` comes from phase 1 `contracts.ts`; weekday `0 = Sunday` is used in SQL, schemas and the editor.
- **Unverified at planning time (implementer must check first):** the exact name and signature of the QR-revoke helper for tests; how `NavId` consumers (sidebar, mobile bar, command palette) enumerate ids so the new entry does not break exhaustive switches; whether a Playwright dashboard-page pattern exists; the neighbouring `src/app/api/menu/**` route conventions for session and error handling; the `audit_logs` column list and required values (`0001_tenant_security.sql`); whether `audit_logs` is writable from a definer function by the migration owner as the existing triggers do.
