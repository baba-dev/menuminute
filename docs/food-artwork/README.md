# Menu-Minute original dish artwork

This Draft PR contains **186 separate 360 × 280 transparent RGBA PNG illustrations** across 18 collections. The original 136 asset paths and bytes remain unchanged; the third review batch adds 50 individually separated illustrations across five additional collections, each with its own light and dark preview.

- [Browse all 186 labeled illustrations](gallery.md).
- [Canonical asset manifest](manifest.json).
- Preview pairs: `docs/food-artwork/previews/third-50/` (light on #fff, dark on #111).
- Third-batch collections: `bengal-odisha-delights`, `bihar-jharkhand-classics`, `northeast-treasures`, `himalayan-comforts`, `indo-chinese-starters-ii`.
- The third batch has 21 exact slug matches with Draft PR #16's India-200 CSV. The other 29 are **not assigned made-up dataset IDs**. Some are alternative names, alternate depictions, or dishes outside the selected CSV scope; resolve before using it as a canonical dataset mapping.

## Accuracy and format

The source sheets were AI-rendered **raster** artwork. Individual cutouts are actual PNG files with alpha, not editable native SVGs or image-embedded fake vectors. One canonical image per dish is used on both approved Ink & Ember light and dark surfaces; review colors and crops in both previews. Do not treat the artwork as ingredient, allergen, dietary, or religious-certification evidence.

All 50 new crops are **awaiting product-owner visual sign-off**. Inspect pale sauces and bread/rice dishes, perimeter/alpha masks, and the serving-bowl boundaries on dark surfaces. The source sheets and local review ZIP are retained in the conversation; the repository contains the individual assets and theme preview pairs.

## Verification before merging

1. Run `node scripts/food-artwork/verify.mjs` (186 unique canonical paths, groups, file bytes, PNG signature, dimensions, RGBA type and checksums when present).
2. Review the [gallery](gallery.md) and all ten light/dark third-batch comparison previews.
3. Reconcile naming and alternatives against India-200 Draft PR #16 where exact dataset IDs are missing.
4. Run fresh CI and require all applicable repository quality lanes to pass on the final head SHA.
5. Request explicit owner approval before merging.

**Asset-only Draft PR**: no runtime behavior, merchant-image priority, menu fallback, sold-out presentation, theme token, or production deployment change. Future fallback: merchant photo → merchant-selected illustration → appropriate dish/category illustration → neutral placeholder.
