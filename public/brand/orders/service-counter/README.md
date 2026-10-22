# MenuMinute Orders 2.0 — The Service Counter artwork

This **draft media-only pull request** prepares the upload destination for exactly seven WebP artwork assets. No image binaries, mocked substitutes, UI changes, SQL changes or live route references are part of the scaffold. Do not merge or activate this PR while artwork is missing.

## Upload destination

In the GitHub UI, **switch to this PR branch** `design/orders-service-counter-media-pr-a` (not `main`), then open `public/brand/orders/service-counter/` and choose **Add file → Upload files**. Extract your artwork ZIP(s) locally and upload just the seven named **.webp** files listed below into this folder. Do **not** upload the ZIP, PNG/JPG previews, a nested folder, or rename PNG to WebP. The README and manifest already establish the destination folder in Git.

| Filename | Required pixels | Alpha | Role |
| --- | ---: | --- | --- |
| `hero-desktop-light.webp` | 2880 × 800 | Opaque | Light full-bleed hero |
| `hero-desktop-dark.webp` | 2880 × 800 | Opaque | Dark full-bleed hero |
| `hero-mobile-light.webp` | 960 × 1000 | Opaque | Light portrait hero |
| `hero-mobile-dark.webp` | 960 × 1000 | Opaque | Dark portrait hero |
| `service-bell.webp` | 700 × 500 | True alpha | Empty/new-order service accent |
| `ticket-stack.webp` | 700 × 500 | True alpha | Order history/empty-state accent |
| `service-complete.webp` | 700 × 500 | True alpha | Successful handoff accent |

**Artwork contract (updated after owner feedback):** These are illustration assets, **not screenshots or rendered UI**. The **desktop heroes** must keep the entire left copy area free of painted text and buttons. On the **mobile heroes and three supporting illustrations**, tasteful **decorative, in-world lettering is encouraged**: small printed MenuMinute/chef packaging marks, `FRESHLY MADE` on a bag or wrapper, `ORDER TICKET` / `THANK YOU` on a receipt, a little `DING!` near the bell, or `READY TO SERVE` as a decorative celebratory motif. Keep it subtle, physically attached to the object or purely ornamental, and independent of state. Do **not** paint page headings, CTA buttons, tabs, filters, statuses, customer details, realistic order numbers, counts, percentages, prices, dates/times, or fake readable live order-screen data. Those remain live accessible HTML. Keep the **upper mobile hero copy-safe area blank** for live title, description and buttons. Three supporting illustrations need genuine transparency, not a flattened checkerboard/white rectangle. Any decorative lettering is never the sole source of meaning or a substitute for semantic UI.

## Finalize after uploading

1. Confirm **exactly seven** `.webp` images appear directly in `public/brand/orders/service-counter/` on this PR branch.
2. With dependencies installed, run `node scripts/verify-orders-media.mjs` (or `pnpm media:verify:orders` if added in the integration PR). The standalone verifier checks filenames, actual WebP decoding, pixel dimensions, opaque/true-alpha properties, and nonempty size, and prints measured byte counts and SHA-256 digests. It intentionally fails while an asset is missing.
3. Replace each `bytes: null` and `sha256: null` in `manifest.json` with its printed measurement, set `status` to `READY_FOR_REVIEW`, and rerun the verifier to enforce checksum locks. These fields are intentionally **unset**, not invented, until your uploaded bytes are present.
4. Visually review desktop and mobile crops at 320/360/390/768/1024/1440 widths, copy-safe area, dark/light, 200% zoom, and the supporting assets over contrasting light/dark surfaces. Check that only permitted in-world decorative lettering is painted into mobile/spot artwork; no functional or numeric UI may be baked in. Format validation cannot prove this.
5. Run required final-head CI after the complete package is present; only then mark the draft ready for review. The future Orders implementation PR should integrate these assets, use build-time verification, and keep all Order/Kitchen Pro state and commercial gates unchanged.

The existing Orders screen and deployment paths are not changed by this PR.
