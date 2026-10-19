# Section 7 — Storefront Sticker Studio

**Status:** Original interactive marketing showcase. The physical stickers and print-production/download workflow are concepts, not an available print-ordering service. This section is intentionally separate from Section 6's Three Service Worlds PR.

| Asset/component         | Purpose                                                         | Source                            |
| ----------------------- | --------------------------------------------------------------- | --------------------------------- |
| `storefront-scene.tsx`  | Layered SVG shopfront, window, door and counter                 | Original artwork                  |
| `sticker-art.tsx`       | Six responsive sticker formats with consistent brand mark       | Based on approved reference sheet |
| `sticker-config.ts`     | Format/surface catalog, explicit public demo destination        | Static, version controlled        |
| `storefront-studio.tsx` | Seven-second one-shot reveal and user-selected preview          | Client component                  |
| `storefront-studio.css` | Ink & Ember light/dark, finite animation, mobile/reduced motion | Scoped section stylesheet         |

## Timed storyboard (7 seconds)

| Interval | Event                                                              |
| -------- | ------------------------------------------------------------------ |
| 0–1.5s   | Storefront/vector glazing, lighting and reflection appear          |
| 1.5–3s   | Default primary QR sticker enters and aligns on glass              |
| 3–4.5s   | Sticker adheres and settles; outline pulse                         |
| 4.5–5.5s | Ember QR highlight appears once, without obscuring real QR pixels  |
| 5.5–7s   | Six selector thumbnails enter in sequence; heading accent settles  |
| After 7s | Final composition; selection is manual, never cycles automatically |

Selectable formats: primary QR, circle, door cling, premium landscape, _example-hours_ vertical and compact. Mounting surfaces: window, door, countertop. Each selected format is one reusable component with the QR pixels generated server-side by the already-installed `qrcode` package. The separate flat QR below the illustration remains scannable when the decal is tilted or scaled for visual demonstration.

## Data and safety contract

The showcase QR resolves **only** to `https://food.bababuilds.com/m/demo-spice-route-kitchen-v1`, the existing public Spice Route Kitchen sample. Never insert a private tenant or imply demo scans create orders. The six mockups are illustrative; no checkout, physical printing, SKU pricing or shop link exists. Hours in the sample sticker are explicitly labeled EXAMPLE HOURS. The `qrcode` QR uses H error correction and white quiet zones with dark square modules, without a centre-overlay logo. Real merchant stickers, their menu token, opening hours and printable exports require a later merchant-authorized scope and physical scan tests.

Playback begins once upon viewport entry, pauses while hidden, respects reduced motion and offers Pause/Replay. Theme is inherited from `data-theme` on the root. Only safe code-authored JSX/SVG is inserted—no externally supplied markup.

## Integration/review

The homepage's generic closing CTA is replaced by `<StorefrontStudio qrDataUrl={qrDataUrl} />`; the new component **retains** registration and live-demo links. No migrations, dependencies or operations changes. Review browser E2E at 320/390/768/1440px, both themes, all six formats, all mounting surfaces and real-demo QR scannability before merge or release. If Section 6 PR merges first, rebase this branch and run its full final-SHA CI; do not overwrite Section 6's change.
