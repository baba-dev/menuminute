# home-v2: "Scan, tap, ordered" (section 2)

Status: **built and previewed** at `/home-v2` (`noindex`, not in the sitemap), directly after the
scroll-assembled dashboard (see [home-v2-dashboard-build.md](home-v2-dashboard-build.md)). It is a
marketing preview with sample data. It is not a live ordering feature and no order is placed.

## Story

Section 1 ends with an order landing on Table 11. Section 2 shows the same order from the guest's side:
a phone scans a QR, shows a tappable sample menu, and the order appears as a ticket and a "Awaiting
acceptance" count in a kitchen tile.

## What is on the page

| Piece            | Effect                                                                                            |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Intro            | Word-by-word blur reveal (first view only)                                                        |
| Stage            | Border beam, dot pattern, 3D phone tilt toward the pointer (mouse or pen only)                    |
| Scan overlay     | Real QR (server generated), corner brackets and a scan laser; scans itself once seen, or on click |
| Phone menu       | Category pills, sort chips, FLIP reorder, dish bottom sheet with stepper, shimmer buttons         |
| Basket bar       | Rolling-number item count and total (shared `RollingNumber`)                                      |
| Order flight     | Tickets slide in; "Send to kitchen" flies particles to a kitchen tile and rolls 0 to 1            |
| Currency card    | Cycles INR / AED / USD / EUR price points with rolling digits until the visitor picks one         |
| Marquee          | Two opposite rows of sample dishes (decorative, `aria-hidden`)                                    |
| Capability cards | Cursor-follow spotlight; each links to an existing public page                                    |

All effects are hand-built (no animation dependency). Only `transform` and `opacity` animate, plus a
one-off blur on first reveal. Pointer effects write CSS variables from a `requestAnimationFrame` and
never set React state per move. Loops pause when the section is off-screen (`data-paused`).

## Rules this section keeps

- **Sample data only.** Dishes and unit prices are the public demo outlet's (Butter Chicken, Biryani,
  Chettinad Chicken, Amritsari Fish). Every dish is `verified: false`; the section makes no allergen,
  dietary or nutrition claim, so the menu sorts by popularity and price, not by dietary tags. A test
  rejects dietary words in dish copy.
- **Currency.** The currency card shows illustrative price points; they are not exchange rates. Outlets
  sell in their local currency; USD and INR restrict platform subscription billing only.
- **No outbound effects.** "Send to kitchen" is local component state. Nothing calls an API, a paid
  provider or order submission.
- **Copy** says this is a sample preview where no real order is placed; ordering itself is live, so it
  is not described as "in development". Links are
  `/help/owner`, `/demo`, `/pricing`, and a test checks each exists.
- **QR.** Generated server-side from `STICKER_DEMO_URL` with `qrcode` at render time, like `/`.

## Accessibility and fallbacks

- Unlike the section 1 picture, the widgets are real, keyboard-operable controls. The dish sheet moves
  focus in, closes on Escape and returns focus to the dish. A polite live region announces basket and
  send changes. Rolling numbers expose their value as visually hidden text.
- Until the QR is scanned, the menu is `inert`.
- `prefers-reduced-motion: reduce`: no beam, laser, tilt, marquee loop, particles or transitions, the
  QR overlay is skipped and the menu is shown immediately; every control still works.
- Scripting off: no overlay and no reveal hiding, so the whole menu and all cards are visible; only
  the interactions need script.

## Files

- `src/components/marketing/scan-to-order/scan-to-order.tsx` (client shell)
- `.../scan-to-order-fixture.ts` (sample dishes, currency samples, card copy)
- `.../scan-to-order-motion.ts` (pure tilt, spotlight, FLIP, rolling-digit and basket helpers)
- `.../scan-to-order.css`
- Mounted in `src/app/home-v2/page.tsx`; `.sto-container` joins the shared grid in `src/app/home-layout.css`.

## Verification (last run)

- `tests/scan-to-order.test.ts`: 10 tests (helpers, fixture, links). Run with a DB-free vitest config
  because the global setup needs a migration database.
- `tests/e2e/home-v2-scan-to-order.spec.ts`: 6 scenarios on desktop and Pixel 5 (12 runs): scan,
  add/sort/send/reset, keyboard sheet, no claims and links, no overflow and axe WCAG 2 A/AA, reduced
  motion. Run against `next dev` with a scratch config and the pre-installed Chromium.
- The 16 existing `home-v2-dashboard-build` runs still pass with the new section on the page.
- `pnpm lint` and `tsc --noEmit` clean for the changed files.

Section 3, [the kitchen board](home-v2-kitchen-board.md), follows it and shares `RollingNumber`.
