# Menu-Minute original dish artwork

This Draft PR contains **86 separate 360 × 280 transparent RGBA PNG illustrations**: the existing 36 (12 Indian, 12 Western, 12 Italian), plus a new 50-dish review batch across five groups of 10.

- [Browse all 86 labeled illustrations](gallery.md).
- [Canonical asset manifest](manifest.json).
- Existing groups: `indian`, `western`, `italian` (unchanged).
- New groups: `north-indian-classics`, `street-food-snacks`, `south-coastal-specials`, `east-northeast-specials`, `indo-chinese-starters` (10 each).

## Accuracy and status

The approved AI-generated **reference sheets are raster images**; these individual crops are real transparent PNGs, **not native SVG vectors**. Editable path-only SVG masters would require a separately reviewed vector redraw. One canonical image per dish should render over both approved Ink & Ember light (#fff) and dark (#111) surfaces; neither theme changes the actual dish artwork. The chat review package includes the original reference boards, individual crops, manifest and light/dark comparison previews.

The 50 additions reflect the *five specifically generated/reviewed category sheets*, rather than a claim that they correspond to sequential rows 1–50 of separate Draft PR #16's India-200 backlog; reconcile names/IDs before updating that backlog. Treat all 50 new crops as **awaiting visual sign-off**: inspect perimeter masking, white foods/sauces and edge clipping in both modes before any runtime use. The original 36 files remain unchanged.

## Verification before merging

1. Run `node scripts/food-artwork/verify.mjs` (86 distinct paths, category counts, PNG signature, dimensions and RGBA color type).
2. Review every new crop in [gallery.md](gallery.md) and the ZIP's per-group light/dark previews.
3. Correct flagged crops by returning to the reference/source art rather than blindly converting PNGs into image-embedded SVG files.
4. Confirm labels, authenticity and appearance with the product owner.
5. Require a fresh successful CI run for all repository lanes on the final SHA.

This artwork-only PR does not change runtime behavior, merchant-photo priority, menu UI, sold-out treatment or theme tokens. Future fallback integration should prefer merchant photography, then merchant-selected illustration, then a suitable dish/category fallback and finally a neutral placeholder. Food artwork does not certify ingredients, allergens or dietary/religious status.
