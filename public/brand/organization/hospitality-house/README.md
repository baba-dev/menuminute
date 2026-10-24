# Hospitality House — Organization 2.0 artwork handoff

This folder stages the **full-bleed, non-transparent hero banners** for MenuMinute's planned Organization 2.0 redesign. The two theme variants use the same composition and follow the existing Dashboard, Menu Studio and QR Studio hero convention: **left-side negative space** for live, accessible heading/body/actions; royal hospitality architecture and atmospheric detail on the **right**. No text or controls are baked into the image.

## Upload the four approved runtime files

Upload these four **WebP files at this exact folder path**, alongside this README and `manifest.json`:

| Filename | Exact pixels | Purpose |
| --- | ---: | --- |
| `hero-desktop-light.webp` | 2880 × 900 | Desktop daylight, ivory/champagne/gold |
| `hero-desktop-dark.webp` | 2880 × 900 | Desktop evening, espresso/antique gold |
| `hero-mobile-light.webp` | 960 × 1120 | Portrait daylight; top reserved for live copy |
| `hero-mobile-dark.webp` | 960 × 1120 | Portrait evening; top reserved for live copy |

**GitHub upload steps**

1. Switch GitHub to branch `feat/organization-hospitality-house-artwork`, not `main`.
2. Open `public/brand/organization/hospitality-house/`.
3. Choose **Add file → Upload files** and select the **four extracted WebP files** (not the ZIP archive or PNG previews).
4. Keep the filenames unchanged, and commit directly to this PR's feature branch.
5. Check the four new files appear in the PR's **Files changed** tab. Leave this PR as draft until visual and asset checks are complete.

The `manifest.json` contains the exact expected dimensions, byte counts and SHA-256 hashes of the prepared approved upload files. If you intentionally re-export them, update the manifest to the new verified values in the same commit; do not silently let it become stale. Avoid committing source previews, placeholder image files, base64 text or ZIPs to the public runtime directory.

## Visual/engineering acceptance

- All four files must be opaque WebP. Desktop art is right-weighted, with a readable calm zone on the left; mobile art preserves the top copy area.
- Hero headings, descriptions, buttons, breadcrumbs and status indicators must be **live HTML**, never embedded text inside a WebP.
- The subsequent Organization 2.0 implementation will select the appropriate desktop/mobile light/dark artwork through scoped CSS; this staging PR does **not** change runtime code or wire the image URLs into the page.
- Validate in both themes at 360 / 390 / 768 / 1024 / 1440px widths, 200% zoom and reduced-motion settings before merging.
- Confirm the new artwork is compatible with the existing shared `WorkspaceTopbar` and no layout shifts/overlapping text occur.

**Merge gate:** draft staging PR → upload four assets → verify dimensions, opacity, bytes/checksums and visual crops → human approval → merge. Implementation of the Organization workspace is a separate follow-on PR.
