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

## Second 50 generated artwork — 2026-10-15

The second new wave adds 50 original raster cutouts, ten each in `tamil-karnataka-fare`, `kerala-signatures`, `andhra-telangana-flavors`, `maharashtra-classics`, and `gujarat-goa-delights`. There are now **136** assets in this PR. Original 86 files are preserved; no menu runtime code is changed.

- The real `360×280` RGBA PNGs are under `public/assets/food/dishes/<category>/` and the ten light/dark proof sheets are under `docs/food-artwork/previews/second-50/`.
- The dark and light proof sheets are **not separate food assets**; one canonical transparent PNG is composited against white and charcoal.
- Source artwork was raster AI-generated category boards. Do not present PNGs as SVG vector masters. Owner should inspect extraction halos, truncated outer edges, pale food on light backgrounds and regional depiction prior to approval.
- The generated second batch is **not an exact sequential rendering of CSV rows 51–100** from Draft PR #16. The manifest assigns `datasetId` only to exact slug matches; unmatched names remain for dataset reconciliation and should not be assigned invented IDs.
- Some illustrations represent alternate renderings of dishes already in the earlier 50 (e.g. appam/stew and puttu/kadala): do not auto-select between them until the owner reviews the preferred canonical mapping.
- Keep the PR Draft until the product owner approves artwork and final CI passes. No merge or deploy from this asset-only change.
