# Receipt UPI QR ("Scan & Pay") design

Status: **approved by the owner on 2026-11-22; implemented on a feature branch, not deployed. Real-device scanning is unverified.** Date: 2026-11-21.

## Intent and why

Merchants take UPI at the counter today by pointing at a sticker or reading out an ID, and staff
then record the tender (`upi_external`) in the till. The owner wants the thermal bill itself to carry a
good-looking, scannable UPI QR that pre-fills the payee, amount and bill reference, so diners pay
faster and mistype less.

The owner explicitly does **not** want MenuMinute to become a payment processor. This feature only
**prints a link the merchant's own UPI ID already accepts**. There is no Razorpay or other provider call,
no money movement, no webhook, no confirmation, and no change to how payments are recorded.

## Goals

- A merchant saves one UPI ID (VPA) per outlet, in outlet Settings and in an optional onboarding step.
- Unpaid INR bills print a framed two-section block: QR on one side, details and instructions on the
  other, on both 58 mm and 80 mm paper.
- The QR encodes everything UPI apps need to pre-fill: payee VPA, payee name, amount, currency INR
  and a bill note.
- Available on **all plans** (owner decision). No entitlement check.
- Identical output from every print path: browser Bluetooth LE, the Android native bridge (Bluetooth
  Classic and USB) and the on-screen preview.

## Non-goals

- No payment collection, provider API, dynamic Razorpay QR, payment confirmation or auto-marking of a
  sale as paid. Staff still record the tender.
- No QR image upload or QR decoding (approach A chosen over C).
- No non-INR output, no bank-account/IFSC QR, no card or wallet links.
- Not on paid, refunded or fiscal ledger documents (A4 and the statutory documents are unchanged).
- No auto-print and no change to the grant, session or membership checks of the print bridge.

## Anti-goals (failure even if it "works")

- A receipt that implies payment was received or confirmed. The existing "PAYMENT PENDING" status and
  non-gateway-confirmed disclaimer stay.
- A QR on paid or refunded receipts that invites double payment.
- A pre-filled amount that differs from the receipt's "Total payable".
- Any merchant text reaching the printer as raw control bytes.
- Logging or auditing the full UPI ID beyond what the merchant sees in Settings.

## Constraints from the repo

- All receipt facts come from the immutable `PosReceipt` through `buildThermalReceipt`; nothing is
  recalculated. The QR amount is the same value as the printed "Total payable" (`totalMinor`, else
  `subtotalMinor`).
- `encodeThermalReceipt` is shared by `src/lib/pos/thermal-ble.ts` (runs in the browser) and
  `src/modules/pos/native-print.ts` (server). The new code must therefore be pure TypeScript with no
  Node-only and no browser-only APIs, and must not depend on installed system fonts.
- Authorization lives in services, not routes. Settings writes mirror the existing sales-tax pattern
  (`0104_outlet_sales_tax_preferences.sql`, `src/modules/tax/service.ts`): `app_private` table,
  `SECURITY DEFINER` read/save functions, outlet scope check, compare-and-swap `revision`, history rows,
  `domain_audit`, `menuminute_app` execute only, demo outlets refused.
- Next.js in this repo has breaking changes: read the relevant guide in `node_modules/next/dist/docs/`
  before writing route or Server Action code.
- Dependencies: reuse the installed `qrcode` (matrix generation only). No new runtime dependency is
  expected.

## Approaches considered

| Approach                                                    | Trade-off                                                                                                                   | Outcome                          |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **A. Merchant enters UPI ID; we generate the QR**           | Crisp, nothing to store or moderate, no new dependency. Merchant must know their UPI ID.                                    | **Chosen by owner**              |
| B. Upload a QR image and print it as is                     | Literal "upload", but screenshots and photos shrink badly to 1-bit at 203 dpi, carry bank branding, and need file handling. | Rejected                         |
| C. Upload, decode the payload, store text, regenerate       | Friendlier input, but adds a decoder dependency and a failure mode. Same end result as A.                                   | Deferred; can be added later     |
| Native ESC/POS QR command (`GS ( k`) vs. raster image block | Native command is tiny but gives no frame, no side-by-side text and varies by printer model.                                | Rejected; raster block is used   |
| Dynamic Razorpay QR                                         | Requires merchant-linked provider accounts and payment processing.                                                          | Rejected by owner (out of scope) |

## Design

### 1. Data

New table `app_private.outlet_receipt_payment_profiles` (migration `0114`, forward-only, additive; the
feature is inert until a merchant saves a profile):

- `outlet_id` primary key, `organization_id`, composite FK to `restaurants(organization_id,id)`
- `upi_id text NOT NULL` with CHECK on the VPA shape, `payee_name text NOT NULL` (2 to 40 characters)
- `enabled boolean NOT NULL`
- `revision integer`, `updated_by`, `updated_at`, plus a history table, as the tax tables do

Functions: `read_outlet_receipt_payment(p_org,p_outlet)` and `save_outlet_receipt_payment(...)`
(compare-and-swap, advisory lock per outlet, `outlet.manage` to write, audit row without the UPI ID,
only `outletId`, `revision` and `enabled`). The read must be callable by every actor allowed to
**print a receipt** (the POS receipt readers), not only `menu.read`; the builder confirms which capability
the receipt page and the native-print redeem path already use and grants exactly that.

Validation, in one shared `parseUpiId` used by form, service and database CHECK:

- `^[a-zA-Z0-9][a-zA-Z0-9._-]{1,255}@[a-zA-Z][a-zA-Z0-9]{1,63}$`, lower-cased and trimmed on save.
- Payee name: printable text, sanitised with the existing `safePrinterText` rules, default is the
  outlet's seller name.

### 2. Payload

`buildUpiPayUri({vpa, payeeName, amountMinor, billNo})` produces

`upi://pay?pa=<vpa>&pn=<payee>&am=<amount>&cu=INR&tn=<note>`

- Amount is a decimal string with exactly two places (for example `840.00`), derived from the minor-unit
  string with integer arithmetic, never floating point.
- `pn` and `tn` are percent-encoded; `tn` is `Bill <orderNumber>` capped at 50 characters.
- Output is capped at 106 bytes (QR version 6 at error-correction level M, 41 modules, still scannable at
  4 dots per module on 58 mm paper). The payee name inside the link is shortened first to fit. The
  cap was raised from 84 bytes (version 5) after review: 84 left out common merchant UPI IDs of 30 to
  40 characters. A UPI ID that cannot fit a worst-case bill (Rs 999999.99, 6-digit bill number) is
  rejected at save time with a clear message, so a merchant never discovers it at the printer.
- No `tr`, `mc` or `url` parameters (those are for registered merchants and can make some apps reject a
  personal VPA).

### 3. When the block prints

Only if all hold: the outlet profile exists and is enabled, receipt currency is `INR`, payment status is
pending (not complete, not refunded), the order is still live (not cancelled, declined or expired), and
the total is greater than zero. There is no "print always" toggle (my call, see below). Otherwise the receipt is byte-identical to today's.

### 4. Layout (one raster block)

A printer cannot place text beside an image, so the QR and the text are drawn together into one 1-bit
bitmap and sent with `GS v 0`. Dot widths: 384 for 58 mm, 576 for 80 mm (matching the 32 and 48 column
assumptions already in `thermalColumns`).

```
80 mm (576 dots)
┌────────────────┬───────────────────┐
│  ┌          ┐  │  SCAN & PAY       │
│   █▀▀▀█ ▄▀ █   │  Rs 840.00        │
│   █ ▀ █ ▀▄ █   │  ───────────      │
│   ▀▀▀▀▀ █▄ ▀   │  1 Open any UPI   │
│  └          ┘  │    app, tap Scan  │
│                │  2 Check the name │
│                │  3 Pay and show   │
│                │    staff the tick │
│                │  spiceroute@okhdfc│
└────────────────┴───────────────────┘
```

- Left section: QR with a 4-module quiet zone, corner brackets and whole-dot module scaling (5 dots per
  module on 80 mm, 4 on 58 mm). A vertical rule
  separates the sections.
- Right section, top to bottom: "SCAN & PAY" heading, amount in larger type, a rule, three numbered
  steps, the payee name and the UPI ID. The bill number is in the QR note and in the existing header.
- 58 mm keeps both sections side by side with a smaller QR and shorter wrapped lines; it never stacks.
- Text is drawn with a small built-in bitmap font (ASCII, two sizes) in the shared module, so browser and
  server produce the same bytes. Long names or IDs wrap or truncate with an ellipsis, never overflow.
- A shared `renderPayBlock(...)` returns the bitmap; the thermal encoder embeds it after the total and
  before the closing status; the HTML preview draws the same bitmap to a canvas or PNG so on-screen preview
  equals print.

### 5. Settings and onboarding

- Settings: a "Get paid by UPI" card in the outlet settings area beside sales-tax preferences (settings
  scope nav in `src/components/settings`), with UPI ID, payee name, an enable switch, a live preview of the
  printed block using a sample amount, and the same compare-and-swap conflict message as tax settings.
- Onboarding: an optional, skippable "Get paid" step after identity, writing through the same service.
  Skipping leaves the outlet unconfigured.
- Copy: no payment-processing language. "This QR opens your UPI app with the amount filled in. Staff still
  record the payment in the till."
- Help-centre article and `docs/android-release/print-bridge.md` status note updated.

### 6. Failure behaviour

- Invalid or missing profile, non-INR, paid, refunded or zero total: no block, normal receipt.
- Payload too long or bitmap build error: no block and the receipt still prints (the QR is an
  enhancement, never a reason a bill fails to print).
- Settings save conflict returns a reload-and-review error. Demo outlets cannot save a profile.

## Decisions I made (owner may overrule)

1. No "print on every receipt" toggle; unpaid bills only, to avoid double payment.
2. QR carries `pa`, `pn`, `am`, `cu`, `tn` only; no `tr` or `mc`.
3. One profile per outlet, not per organization.
4. Built-in pixel font for the text, rather than canvas or server fonts.
5. INR only.
6. Settings writes need `outlet.manage` (owner and manager), same as tax settings.
7. New migration `0114`; settings table lives in `app_private`; its history keeps only a masked UPI
   hint, never the full ID.
8. After a split or partial tender the QR still asks for the full total (known limitation, owner to
   decide; only matters where POS finance tenders are enabled).

## Left to the builder

- Exact bitmap font and glyph metrics, step wording within the 58 mm width budget, and spacing.
- Which existing capability name the receipt readers use for the read function.
- Splitting into pull requests (suggested: pure encoder and tests; migration and service; Settings and
  onboarding UI; docs).
- Chunking of the larger image over BLE: the 80 mm block is roughly 16 KB, confirm the existing writer
  handles it.

## Verification plan

- Unit tests: `parseUpiId`, `buildUpiPayUri` (encoding, two-decimal amount, length cap, rounding-free),
  bitmap size and `GS v 0` header for both papers, block omitted for paid, refunded, non-INR and disabled
  cases, and that a receipt without the block is byte-identical to the current output.
- A test-only QR decode (dev dependency only if its licence, maintenance and provenance pass review) to
  prove the printed matrix decodes to the exact URI for both paper sizes.
- Integration tests against real PostgreSQL: outlet-scope isolation, compare-and-swap conflict, history
  and audit rows contain no UPI ID, demo outlet refused, read allowed for receipt readers only.
- Repo gates: lint, typecheck, tests, production build, Markdown format check, `git diff --check`.
- **Owed and not claimable by CI:** scanning the printed block with real apps (Google Pay, PhonePe,
  Paytm, BHIM) on real 58 mm and 80 mm Bluetooth and USB printers, including a personal-style VPA.
  Pre-filled amounts may be shown as editable or ignored by some apps; record findings in
  `docs/android-release/device-test-matrix.md` and do not advertise printer or app compatibility
  until rows pass.

## Risks

- UPI apps differ in how they treat `am` for personal VPAs; mitigated by copy ("check the amount") and
  by device testing.
- A merchant could enter a wrong UPI ID; mitigated by the preview and payee-name confirmation, but the
  merchant owns correctness.
- Raster block increases print time slightly on slow BLE printers.

## Rollout and rollback

Additive migration and an inert feature. Rollback is by not merging the UI/encoder change; the table may
stay (forward-only recovery per repository rules). No deployment is implied by this document.
