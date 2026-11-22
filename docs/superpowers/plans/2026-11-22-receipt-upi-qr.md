# Receipt UPI QR ("Scan & Pay") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Print a framed two-section "Scan & Pay" block (UPI QR beside amount and instructions) on unpaid INR thermal receipts, driven by a per-outlet UPI ID the merchant saves in Settings or onboarding.

**Architecture:** A pure shared library (UPI link builder, 1-bit bitmap renderer with a built-in pixel font) feeds `encodeThermalReceipt`, so the browser Bluetooth path, the Android bridge and the on-screen preview emit identical output. A small `app_private` profile table with `SECURITY DEFINER` read/save functions (mirroring the sales-tax pattern) stores the UPI ID. `buildThermalReceipt` decides whether a block prints.

**Tech Stack:** TypeScript, Vitest, PostgreSQL + Drizzle/pg (forward-only SQL migration `0114`), Next.js route handlers, the installed `qrcode` package (matrix only), dev-only `jsqr` for decode tests.

**Spec:** `docs/superpowers/specs/2026-11-21-receipt-upi-qr-design.md` (approved by the owner on 2026-11-22). Read it and `AGENTS.md` first; this repo's Next.js has breaking changes, so read `node_modules/next/dist/docs/` before writing route code.

## Global Constraints

- Prices, taxes, statuses and totals are copied from the immutable receipt, never recalculated. The QR amount is the same value as the printed "Total payable" (`totalMinor`, else `subtotalMinor`).
- Block prints only if: profile exists and is enabled, receipt `currency` is `INR`, `paymentStatus` is neither `complete` nor `refunded`, and total minor units > 0. Otherwise output must be byte-identical to today's.
- UPI link: `upi://pay?pa=<vpa>&pn=<payee>&am=<NNN.NN>&cu=INR&tn=Bill <orderNumber>`; no `tr`, `mc` or `url`. Capped at 84 bytes (QR version 5, level M). The payee name in the link is shortened first; if it still does not fit, no block.
- UPI ID pattern: `^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$`, trimmed and lower-cased. Payee name 2 to 40 characters from `[A-Za-z0-9 .&'-]`.
- Paper widths: 384 dots (58 mm), 576 dots (80 mm). Module scale: 5 dots (80 mm), 4 dots (58 mm), 4-module quiet zone.
- Shared library code must be pure TypeScript (no Node-only, no browser-only APIs, no fonts from the system): it runs in the browser BLE path and on the server.
- Settings writes need `outlet.manage`; demo outlets refused; compare-and-swap `revision`; audit rows must never contain the UPI ID.
- Available on all plans: no entitlement check anywhere.
- No payment provider call, no new outbound network access, no dependency other than dev-only `jsqr` (pin exactly; MIT, pure JS so ARM64-safe; record the provenance review in the PR).
- Migration is additive and forward-only; never edit applied migrations; do not run `db:push`.
- Verification before any success claim: `pnpm lint`, `pnpm typecheck`, relevant `pnpm vitest run <file>`, `pnpm build`, `pnpm format:check`, `git diff --check`. Use frozen-lockfile installs.
- Delivery: work on branch `claude/ecstatic-wright-nb9vso` (the only permitted branch), one commit per task, on the existing draft PR baba-dev/menuminute#361. Do not deploy; do not claim printer or UPI-app compatibility.

## Review Focus

Failure modes the spec implies but no single task would otherwise pin; each has a test in the named task.

- A total of `0`, a huge total, or a total with leading zeros: no block for zero; correct two-decimal amount otherwise (Task 1).
- A UPI ID or payee name designed to inject parameters (`a@b&am=1`, `x@y#`, uppercase, spaces, lookalike Unicode, two `@`): rejected or encoded, never able to add or split parameters (Task 1).
- A very long payee name or UPI ID: name shortened or block omitted, text never overflows the right section, receipt still prints (Tasks 1, 2).
- Two tabs saving the settings at once, a viewer role saving, or a demo outlet saving: 409, forbidden, refused respectively (Task 4).
- Paid, refunded, non-INR, disabled and unconfigured receipts: byte-identical to current output on both paper sizes (Tasks 3, 5).

## File Structure

- Create `src/lib/pos/upi.ts`: UPI ID and payee validation, amount formatting, link builder (pure).
- Create `src/lib/pos/pay-block-font.ts`: 5x7 ASCII pixel font data and glyph lookup (pure).
- Create `src/lib/pos/pay-block.ts`: `renderPayBlock`, `payBlockToEscPos`, `payBlockToRgba` (pure).
- Modify `src/lib/pos/thermal-receipt.ts`: optional `payBlock` field and embedding in `encodeThermalReceipt`.
- Create `src/db/migrations/0114_receipt_upi_payment.sql` and append journal entry in `src/db/migrations/meta/_journal.json`.
- Create `src/modules/receipt-payment/service.ts`: schema, read/save.
- Create `src/app/api/organizations/[organizationId]/outlets/[outletId]/receipt-payment/route.ts`.
- Modify `src/modules/pos/thermal-view.ts`, `src/modules/pos/native-print.ts`, `src/app/(dashboard)/dashboard/pos/receipts/[saleId]/page.tsx`, `receipt.css`.
- Create `src/components/pos/pay-block-preview.tsx` (client canvas, shared by receipt page and Settings).
- Create `src/app/(dashboard)/dashboard/settings/payments/page.tsx`, `src/components/settings/receipt-payment-settings-form.tsx`; modify `outlet-atelier.tsx` (link) and `workspace-breadcrumb.ts`.
- Modify onboarding: `wizard-types.ts`, `onboarding-wizard.tsx`, `quick-menu-flow.ts`, create `wizard-steps/step-get-paid.tsx`, modify `src/modules/onboarding/service.ts`.
- Tests under `tests/`: `upi-pay.test.ts`, `pay-block.test.ts`, extend `thermal-receipt.test.ts`, `receipt-payment.integration.test.ts`, `receipt-payment-view.test.ts`, extend onboarding tests.

---

### Task 1: UPI core (pure)

**Files:**

- Create: `src/lib/pos/upi.ts`
- Test: `tests/upi-pay.test.ts`

**Interfaces:**

- Produces:

  - `parseUpiId(raw: string): string | null` (trimmed, lower-cased valid ID, else null)
  - `normalizePayeeName(raw: string): string | null` (NFKD, strip diacritics, drop characters outside `[A-Za-z0-9 .&'-]`, collapse spaces, trim; null if result is not 2 to 40 characters)
  - `inrMinorToDecimal(minor: string): string | null` (`"84000"` gives `"840.00"`; null unless `/^[0-9]{1,12}$/` and value > 0; strips leading zeros with BigInt, no floats)
  - `buildUpiPayUri(i: { vpa: string; payeeName: string; amountMinor: string; billNo: string }): string | null` (null on any invalid input or if still over 84 bytes at a 2-character payee name)

- [ ] **Step 1: Write the failing tests** in `tests/upi-pay.test.ts`:
  - `parseUpiId(" Spice@OkHDFC ")` is `"spice@okhdfc"`; rejects `"a@b"`, `"a b@ok"`, `"a@b@c"`, `"a@b&am=1"`, `"a@ok#x"`, `"é@ok"`, `""`, and a 300-character local part.
  - `inrMinorToDecimal("84000")` is `"840.00"`, `("5")` is `"0.05"`, `("0007")` is `"0.07"`, `("0")`, `("")`, `("12.5")`, `("-1")`, `("1".repeat(13))` are null.
  - `buildUpiPayUri({vpa:"spiceroute@okhdfc",payeeName:"Spice Route Kitchen",amountMinor:"84000",billNo:"1042"})` equals `upi://pay?pa=spiceroute@okhdfc&pn=Spice%20Route%20Kitchen&am=840.00&cu=INR&tn=Bill%201042`, which is at most 84 bytes.
  - A 40-character payee name that pushes the link past 84 bytes is shortened and the result is still at most 84 bytes; a payee `"A&B=C"` normalises so the output contains exactly one each of `pa=`, `pn=`, `am=`, `cu=`, `tn=` (parse with `new URLSearchParams`).
  - A 120-character UPI ID returns null (cannot fit).
- [ ] **Step 2: Run** `pnpm vitest run tests/upi-pay.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement** the four functions in `src/lib/pos/upi.ts`. Shorten `pn` by trimming trailing characters (then trailing space) until the link fits; `tn` is `Bill <billNo>` with `billNo` restricted to `[A-Za-z0-9-]` (else null). Use `encodeURIComponent` for `pn` and `tn`.
- [ ] **Step 4: Run** the test again. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pos): UPI link builder and validation`.

### Task 2: Pixel font and pay-block renderer (pure)

**Files:**

- Create: `src/lib/pos/pay-block-font.ts`, `src/lib/pos/pay-block.ts`
- Test: `tests/pay-block.test.ts`
- Modify: `package.json`, lockfile (dev dependency `jsqr` exact version `1.4.0`)

**Interfaces:**

- Consumes: `buildUpiPayUri` string (Task 1); `ThermalPaper` from `src/lib/pos/thermal-receipt.ts` (type import only, to avoid a runtime cycle).
- Produces:

  - `type PayBlockInput = { uri: string; amountLabel: string; payeeName: string; upiId: string }`
  - `type PayBlockBitmap = { widthDots: number; heightDots: number; widthBytes: number; data: Uint8Array }` (1 = black, MSB first, rows packed)
  - `renderPayBlock(input: PayBlockInput, paper: ThermalPaper): PayBlockBitmap | null` (null if the link needs more than QR version 5 or anything throws)
  - `payBlockToEscPos(b: PayBlockBitmap): number[]` (`GS v 0` raster in bands of at most 128 rows: `0x1d 0x76 0x30 0x00 xL xH yL yH` plus data per band)
  - `payBlockToRgba(b: PayBlockBitmap): Uint8ClampedArray` (for canvas preview)

- [ ] **Step 1: Add the dev dependency.** Review `jsqr` licence, maintenance and native-code (pure JS). Run `pnpm add -D --save-exact jsqr@1.4.0`, then `pnpm install --frozen-lockfile` to confirm the lockfile is consistent. Note the review in the commit body.
- [ ] **Step 2: Write the failing tests** in `tests/pay-block.test.ts`:
  - For both papers, `renderPayBlock` returns `widthDots` 576 (80) or 384 (58), `widthBytes * 8 === widthDots`, `data.length === widthBytes * heightDots`.
  - Decode round trip: convert the bitmap with `payBlockToRgba`, crop the left section, run `jsQR`, and assert the decoded text equals the input `uri` for 58 and 80 mm and for a long-name link at the 84-byte limit.
  - Layout: the right section contains ink (non-empty) and the rightmost 4 columns of the bitmap are blank (no overflow) even for a 40-character payee and a 60-character UPI ID.
  - `renderPayBlock` returns null for a 200-character `uri`.
  - `payBlockToEscPos` starts with `[0x1d,0x76,0x30,0x00]`, and for a bitmap taller than 128 rows emits more than one header; total data bytes equal `widthBytes * heightDots`.
- [ ] **Step 3: Run** `pnpm vitest run tests/pay-block.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - `pay-block-font.ts`: `glyphFor(ch: string): readonly number[]` returning 7 rows of 5-bit patterns for printable ASCII (space to `~`), `?` for anything else. Include the full table.
  - `pay-block.ts`: QR matrix from `QRCode.create(uri, { errorCorrectionLevel: "M" })` (verify `qrcode` resolves in the browser bundle; its browser entry exports `create`), scale 5 (80 mm) or 4 (58 mm), 4-module quiet zone. Left section width is `(modules + 8) * scale + 4` dots with corner brackets; a 1-dot vertical rule; right section holds, top to bottom: "SCAN & PAY" (scale 2), `amountLabel` (scale 3 if it fits, else 2), a rule, three numbered steps (scale 1 on 58 mm if scale 2 does not fit, wrapped to the section width), payee name, UPI ID (truncate with `...`). Texts are uppercased only where the spec sketch shows it. Whole block is framed with a 2-dot border.
- [ ] **Step 5: Run** the tests. Expected: PASS. Print the 80 mm bitmap as ASCII art once (throwaway script, not committed) and eyeball the layout against the spec sketch.
- [ ] **Step 6: Commit** `feat(pos): render the Scan & Pay raster block`.

### Task 3: Embed the block in the thermal encoder

**Files:**

- Modify: `src/lib/pos/thermal-receipt.ts` (type at lines 7-35, `encodeThermalReceipt` after the total pair near lines 151-154)
- Test: `tests/thermal-receipt.test.ts`

**Interfaces:**

- Consumes: `PayBlockInput`, `renderPayBlock`, `payBlockToEscPos` (Task 2).
- Produces: `ThermalReceipt.payBlock?: PayBlockInput | null`; `encodeThermalReceipt` unchanged signature.

- [ ] **Step 1: Write the failing tests** (extend the existing file, reusing its `receipt` fixture):
  - Without `payBlock`, output bytes equal a stored snapshot of the current output for both papers (capture the snapshot from the unmodified encoder first, as a hex string constant in the test).
  - With a valid `payBlock`, output contains the sequence `1d 76 30 00`, contains the bytes of the closing status text after the raster, and is longer than without.
  - With `payBlock` whose link is too long (`renderPayBlock` null), output equals the no-block snapshot.
- [ ] **Step 2: Run** `pnpm vitest run tests/thermal-receipt.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3: Implement** in `thermal-receipt.ts`: `payBlock?: PayBlockInput | null` on the type; after the total and its separator, if `payBlock` renders, push a blank line, `esc(0x1b,0x61,0x00)` (left), the `payBlockToEscPos` bytes, a blank line, then continue with the closing status. Rendering errors are swallowed (no block).
- [ ] **Step 4: Run** the full file and `pnpm vitest run tests/pos-receipt-printing.test.ts tests/native-print-grant.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pos): print the pay block on thermal receipts`.

### Task 4: Database profile and service

**Files:**

- Create: `src/db/migrations/0114_receipt_upi_payment.sql`
- Modify: `src/db/migrations/meta/_journal.json` (append idx 113, tag `0114_receipt_upi_payment`, `when` 1797080400046)
- Create: `src/modules/receipt-payment/service.ts`, `src/app/api/organizations/[organizationId]/outlets/[outletId]/receipt-payment/route.ts`
- Test: `tests/receipt-payment.integration.test.ts`, `tests/receipt-payment-schema.test.ts`

**Interfaces:**

- Consumes: `parseUpiId`, `normalizePayeeName` (Task 1); `withOutlet`, `withActor`, `Actor` from `@/modules/tenancy/service`.
- Produces:

  - `type ReceiptPaymentProfile = { configured: boolean; upiId: string | null; payeeName: string | null; enabled: boolean; revision: number; updatedAt: string | null }`
  - `receiptPaymentCommandSchema` (strict zod: `expectedRevision: int >= 0`, `upiId`, `payeeName`, `enabled: boolean`; transforms through Task 1 parsers)
  - `getOutletReceiptPayment(actor, organizationId, outletId): Promise<ReceiptPaymentProfile>`
  - `saveOutletReceiptPayment(actor, organizationId, outletId, raw: unknown): Promise<ReceiptPaymentProfile>` (409 `ConflictError` on revision mismatch, `ValidationError` on 22023, forbidden for non-managers)
  - SQL: `app_private.read_outlet_receipt_payment(p_org text,p_outlet text) jsonb`, `app_private.save_outlet_receipt_payment(p_org text,p_outlet text,p_expected integer,p_data jsonb) jsonb`

- [ ] **Step 1: Write failing tests.**
  - `receipt-payment-schema.test.ts` (no DB): the schema rejects unknown keys, invalid UPI IDs, a 1-character payee name; accepts and normalises `" Spice@OkHDFC "`.
  - `receipt-payment.integration.test.ts` (use `fixture("INR")` from `tests/helpers.ts`, as `live-sales-tax.integration.test.ts` does): fresh outlet reads `{configured:false, enabled:false, revision:0}`; save with revision 0 returns revision 1; saving again with revision 0 throws `ConflictError`; a second user who is a non-manager member cannot save; a user from another organization cannot read or save; a demo outlet (`is_demo_data`) cannot save; history table has one row per revision; `domain_audit` row for `outlet.receipt_payment.settings` exists and its `details` text does not contain the UPI ID; the app role cannot select from the table directly (expect permission error).
- [ ] **Step 2: Run** `pnpm vitest run tests/receipt-payment-schema.test.ts tests/receipt-payment.integration.test.ts` (integration needs the CI-style Postgres env, see `docs/testing-strategy.md`). Expected: FAIL.
- [ ] **Step 3: Write the migration** modelled line for line on `0104_outlet_sales_tax_preferences.sql`: tables `app_private.outlet_receipt_payment_profiles` (`outlet_id` PK, `organization_id`, `upi_id` with CHECK matching the Global Constraints pattern in SQL, `payee_name` CHECK 2-40 and `~ '^[A-Za-z0-9 .&''-]+$'`, `enabled boolean`, `revision >0`, `updated_by` FK users, `updated_at`, composite FK to `restaurants(organization_id,id)`) and `..._history`; REVOKE from PUBLIC and all app roles; `read_` function allowed when `app_private.pos_access(p_outlet,'read') OR app_private.can_outlet(p_outlet,'outlet.manage')` and `app.outlet_id` matches, returns the unconfigured shape when no row; `save_` function requires `can_outlet(...,'outlet.manage')`, validates keys (`upiId`,`payeeName`,`enabled`), takes the per-outlet advisory lock, refuses demo/inactive outlets, compare-and-swap on revision (error 40001), writes row, history and `domain_audit` (details: `outletId`, `revision`, `enabled` only); both `SECURITY DEFINER`, `SET search_path=pg_catalog,public,pg_temp`, EXECUTE granted to `menuminute_app` only.
- [ ] **Step 4: Implement the service** mirroring `src/modules/tax/service.ts` (use `withOutletRead`-free path for the receipt read: call the read function inside `withActor` after `set_config('app.outlet_id', …, true)` as `posCall` does in `src/modules/pos/service.ts:114`, so POS readers who are not managers can read). Map `40001` to `ConflictError("Receipt payment settings changed elsewhere. Reload and review before saving.")` and `22023` to `ValidationError`. Add the route by copying the tax route (GET and PATCH, `cache-control: private, no-store`).
- [ ] **Step 5: Run** the two test files and `pnpm vitest run tests/db-schema-migrations.test.ts`. Expected: PASS.
- [ ] **Step 6: Commit** `feat(settings): receipt UPI payment profile and API`.

### Task 5: Decide per receipt and wire all print paths

**Files:**

- Modify: `src/modules/pos/thermal-view.ts`, `src/modules/pos/native-print.ts` (near line 124), `src/app/(dashboard)/dashboard/pos/receipts/[saleId]/page.tsx`
- Test: `tests/receipt-payment-view.test.ts`

**Interfaces:**

- Consumes: `ReceiptPaymentProfile` and `getOutletReceiptPayment` (Task 4); `buildUpiPayUri`, `inrMinorToDecimal` (Task 1); `PayBlockInput` (Task 2).
- Produces:

  - `payBlockForReceipt(receipt: PosReceipt, profile: ReceiptPaymentProfile | null): PayBlockInput | null` in `thermal-view.ts`
  - `buildThermalReceipt(receipt, outlet, profile?: ReceiptPaymentProfile | null)` (third parameter optional, so existing callers still compile)

- [ ] **Step 1: Write failing tests** (pure, build a minimal `PosReceipt` object): unpaid INR with enabled profile returns `amountLabel "Rs 840.00"` and a `uri` containing `am=840.00` and `tn=Bill%201042`; the amount comes from `totalMinor` when present, else `subtotalMinor`; returns null when `paymentStatus` is `complete`, `refunded`, currency is `USD`, profile disabled, profile null, total is `"0"`; `buildThermalReceipt(receipt, outlet)` with no profile equals the output without the new field (no `payBlock` key present).
- [ ] **Step 2: Run** `pnpm vitest run tests/receipt-payment-view.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement** `payBlockForReceipt` and thread the profile through `buildThermalReceipt`. In `native-print.ts`, load the profile with `getOutletReceiptPayment` after `posReceipt` and pass it; a read error must not block printing (log without the UPI ID and print without the block). In the receipt `page.tsx`, load the profile with `getOutletReceiptPayment` and pass it to `buildThermalReceipt`; rendering the preview happens in Task 6.
- [ ] **Step 4: Run** the new test plus `pnpm vitest run tests/native-print-grant.test.ts tests/pos-receipt-printing.test.ts tests/thermal-receipt.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pos): decide and wire the pay block for every print path`.

### Task 6: On-screen preview and receipt page

**Files:**

- Create: `src/components/pos/pay-block-preview.tsx`
- Modify: `src/app/(dashboard)/dashboard/pos/receipts/[saleId]/page.tsx`, `receipt.css`
- Test: `tests/pay-block-preview.test.tsx` (use the repo's existing React testing setup; follow a nearby `.test.tsx`)

**Interfaces:**

- Consumes: `renderPayBlock`, `payBlockToRgba` (Task 2); `PayBlockInput` (Task 2).
- Produces: `PayBlockPreview({ block, paper }: { block: PayBlockInput; paper: ThermalPaper })` client component drawing the bitmap to a `<canvas>` with `role="img"` and `aria-label="UPI payment QR for Rs <amount>"`, rendering nothing if `renderPayBlock` is null.

- [ ] **Step 1: Write the failing test:** renders a canvas with the expected width for each paper and the aria-label; renders nothing for an over-long link.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** the component (`useEffect` draws with `putImageData`; CSS `image-rendering: pixelated`, `max-width: 100%`), insert it in `page.tsx` between the total row and the closing rule when `thermal.payBlock` exists, and add `.receipt-pay-block` styles in `receipt.css` that keep it visible and black-on-white under `@media print`.
- [ ] **Step 4: Run** the test, then `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(pos): show the pay block on the receipt page`.

### Task 7: Settings page

**Files:**

- Create: `src/app/(dashboard)/dashboard/settings/payments/page.tsx`, `src/components/settings/receipt-payment-settings-form.tsx`
- Modify: `src/app/(dashboard)/dashboard/settings/outlet-atelier.tsx` (add a link beside the existing `/dashboard/settings/tax` link near line 428), `src/app/(dashboard)/workspace-breadcrumb.ts` (entry beside line 40: path `/dashboard/settings/payments`, label "Get paid by UPI")
- Test: `tests/receipt-payment-form.test.tsx`

**Interfaces:**

- Consumes: `getOutletReceiptPayment` (Task 4), `PayBlockPreview` (Task 6), `parseUpiId` and `normalizePayeeName` (Task 1), the PATCH route (Task 4).
- Produces: route `/dashboard/settings/payments`.

- [ ] **Step 1: Write failing tests:** form shows the unconfigured state; invalid UPI ID shows an inline error and disables Save; valid values enable Save and show the live preview with a sample amount of `Rs 840.00` and bill `1042`; on a 409 response the reload-and-review message appears; a non-manager (`canManage=false`) sees read-only fields; when currency is not `INR`, a notice says the block prints only for INR bills.
- [ ] **Step 2: Run** the test. Expected: FAIL.
- [ ] **Step 3: Implement** the page by copying the structure of `settings/tax/page.tsx` (auth redirect, outlet lookup, `canManageOutletProfile`, demo outlets read-only) and the form by copying the fetch/PATCH/conflict handling of `sales-tax-settings-form.tsx`. Copy must say: "This QR opens your UPI app with the amount filled in. Staff still record the payment in the till." Fields: UPI ID, payee name (default: outlet name, normalised), enable switch.
- [ ] **Step 4: Run** the test, `pnpm typecheck && pnpm lint`. Expected: PASS.
- [ ] **Step 5: Commit** `feat(settings): Get paid by UPI settings page`.

### Task 8: Onboarding step

**Files:**

- Modify: `src/components/onboarding/wizard-types.ts` (add `upiId: string`, `upiPayeeName: string`, default `""`), `src/components/onboarding/onboarding-wizard.tsx` (`STEPS` and `validateStep`), `src/components/onboarding/quick-menu-flow.ts`, `src/modules/onboarding/service.ts`
- Create: `src/components/onboarding/wizard-steps/step-get-paid.tsx`
- Test: extend the existing onboarding/quick-start tests (find with `grep -rl visibleOnboardingSteps tests`), add `tests/onboarding-upi.test.ts`

**Interfaces:**

- Consumes: `parseUpiId`, `normalizePayeeName` (Task 1); `saveOutletReceiptPayment` (Task 4); `PayBlockPreview` (Task 6, optional preview).
- Produces: new wizard step "Get paid" immediately before launch (launch becomes the last index); onboarding draft accepts `upiId` and `upiPayeeName`.

- [ ] **Step 1: Write failing tests:**
  - `onboardingDraftSchema.safeParse({ upiId: "x@okhdfc", upiPayeeName: "Cafe" })` succeeds and `createRestaurantSchema.safeParse` of a draft that includes those keys still succeeds with the keys stripped from the result.
  - `visibleOnboardingSteps(false)` includes the new step and ends with the launch index; `visibleOnboardingSteps(true)` (Quick Start) excludes the new step; `nextOnboardingStep`/`previousOnboardingStep` still walk correctly.
  - Step validation: empty `upiId` is valid (skippable); non-empty invalid `upiId` returns an error message.
  - Integration (extend the existing onboarding integration test if there is one, else add to `receipt-payment.integration.test.ts`): provisioning with a UPI draft creates the outlet and a saved profile with `revision 1`; provisioning with an invalid or failing profile still creates the outlet and leaves the profile unconfigured.
- [ ] **Step 2: Run** those tests. Expected: FAIL.
- [ ] **Step 3: Implement:** extend `onboardingDraftSchema` in `onboarding/service.ts` with optional `upiId`/`upiPayeeName` (`.partial().extend(...).strict()`); in `provisionOnboarding`, after `createRestaurant` succeeds, read `upiId`/`upiPayeeName` from `state.draft`, and if present call `saveOutletReceiptPayment(actor, outlet.organizationId, outlet.id, { expectedRevision: 0, upiId, payeeName: upiPayeeName || outlet.name, enabled: true })` inside a try/catch that logs the failure without the UPI ID and never fails provisioning. Add the step component (UPI ID field, payee name defaulting to the restaurant name, a skip button, the preview, same copy as Settings), renumber `STEPS`, `validateStep` and `visibleOnboardingSteps` (full `[0,1,2,3,4,5]`, quick `[0,1,5]`). Check every place that hard-codes the launch index (`grep -n "STEPS.length - 1\|step === 4" src/components/onboarding`).
- [ ] **Step 4: Run** the tests plus all existing onboarding tests (`pnpm vitest run tests/ -t onboarding`). Expected: PASS.
- [ ] **Step 5: Commit** `feat(onboarding): optional Get paid by UPI step`.

### Task 9: Docs, help and release evidence

**Files:**

- Modify: `docs/android-release/print-bridge.md` (status note: payload now includes a raster block, untested on hardware), `docs/android-release/device-test-matrix.md` (add owed rows: Google Pay, PhonePe, Paytm, BHIM scans of 58 mm and 80 mm Bluetooth and USB prints, personal-style VPA), `src/content/help/owner-articles.ts` (new article "Print a UPI QR on bills"), `docs/product-roadmap.md` or the nearest current-status doc (implemented vs planned), `docs/superpowers/specs/2026-11-21-receipt-upi-qr-design.md` (status line: approved and implemented)
- Test: help-content tests in `src/content/help/__tests__` (run as they exist)

- [ ] **Step 1: Write** the docs and help article. State plainly that no UPI-app or printer compatibility is verified until the device matrix rows pass, and that the receipt remains a non-fiscal operational bill.
- [ ] **Step 2: Run** `pnpm vitest run src/content/help` and `pnpm format:check`. Fix formatting with `pnpm exec prettier --write <changed docs>`.
- [ ] **Step 3: Run the full gate:** `pnpm lint && pnpm typecheck && pnpm vitest run && pnpm build && git diff --check`. Expected: all pass; report any baseline failure separately instead of weakening a check.
- [ ] **Step 4: Commit** `docs: receipt UPI QR status, help and device-test rows`, push, retitle PR #361 to describe the feature, and list the owed device testing in its Evidence section.

---

## Self-review notes

- Spec coverage: payload (Task 1), layout and font (Task 2), encoder embedding and paid/refunded/non-INR omission (Tasks 3 and 5), data and authorization (Task 4), settings and onboarding (Tasks 7 and 8), preview parity (Task 6), docs and owed device testing (Task 9), all-plans (no entitlement code anywhere).
- Known risks to watch during execution: the existing receipt builder formats money with `Intl`, so `₹` may print as `?` on thermal printers (pre-existing; the pay block uses an explicit `Rs ` prefix); the `GS v 0` image is about 17 KB on 80 mm, so confirm `src/lib/pos/thermal-ble.ts` chunking handles it; Quick Start skipping the new step is a call, not a spec requirement.
