# Menu-Minute dish artwork — Draft review

There are **224 separately named transparent 360×280 RGBA PNG illustrations across 22 collections**. The first 186 existing artwork files are unchanged. Sheets A–D added 38 unique images from 40 illustrated cells: two dishes (Veg Hakka Noodles and Chicken Fried Rice) appear on both A and B, with B as the canonical file.

- [Browse all artwork](gallery.md) · [canonical manifest](manifest.json)
- New source groups: `high-demand-essentials (8)`, `indo-chinese-mains-soups (10)`, `north-indian-rajasthani (10)`, `regional-restaurant-favorites (10)`.
- [Sheet A light preview](previews/sheets-abcd/preview-high-demand-essentials-light.jpg) · [dark](previews/sheets-abcd/preview-high-demand-essentials-dark.jpg)
- [Sheet B light preview](previews/sheets-abcd/preview-indo-chinese-mains-soups-light.jpg) · [dark](previews/sheets-abcd/preview-indo-chinese-mains-soups-dark.jpg)
- [Sheet C light preview](previews/sheets-abcd/preview-north-indian-rajasthani-light.jpg) · [dark](previews/sheets-abcd/preview-north-indian-rajasthani-dark.jpg)
- [Sheet D light preview](previews/sheets-abcd/preview-regional-restaurant-favorites-light.jpg) · [dark](previews/sheets-abcd/preview-regional-restaurant-favorites-dark.jpg)

## Source/QA

These are cutouts from original AI-generated raster contact sheets, **not native path-based SVGs** or SVG wrappers. Use the same transparent dish file against both Ink & Ember appearance surfaces. Confirm illustration-specific accuracy, small residual matte pixels, high-contrast outlines and apparent clipping at the contact-sheet edges. All new files carry per-file SHA-256 checksums in the manifest. The original sheets and extraction manifest are in the conversation review ZIP.

New artwork has exact matched `datasetId` from the separate 200-dish Draft PR #16 where available. Variants not listed in that CSV (Chicken Biryani, Plain Veg Dosa, Chicken Nuggets, White Chocolate Cake) are not assigned fictitious IDs. The Sheet C regional Makki da Saag combo uses the real dataset's alternate slug, and shared Sheet A/B duplicates have no repeated manifest entries. Do not update PR #16's status before owner review and merge agreement.

Run `node scripts/food-artwork/verify.mjs`, require fresh CI on the final head, and visually approve all four sheets in both themes before merging. No runtime menu changes or auto-replacement of eatery-uploaded photography; do not infer dietary/allergen/certification data from an illustration.
