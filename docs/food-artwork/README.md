# Dish artwork — staging review

This review branch tracks the user's approved three AI-rendered concept sheets and their 36 **separated, labeled** illustrations (12 Indian, 12 Western, 12 Italian).

**Status: binary import pending.** The actual 36 RGBA files and the source sheets were generated in the ChatGPT workspace and packaged as `menuminute-approved-dishes-review.zip`. GitHub's connected text/encoded-blob interface cannot directly consume a local sandbox binary path. Do not represent this staging PR as an asset-complete change or merge it before importing the images.

## Approved artwork & canonical naming

See `manifest.json` for all filenames. Intended location:

```
public/assets/food/dishes/
├── indian/   # 12 transparent PNGs
├── western/  # 12 transparent PNGs
└── italian/  # 12 transparent PNGs
```

## Required importer steps

1. Download the finished review ZIP from the conversation and extract it.
2. Copy its `public/assets/food/dishes` subtree to the root of this branch.
3. Copy `asset-manifest.json` and the preview sheets to `docs/food-artwork/review/`; keep the original concept sheets in `docs/food-artwork/review/reference-sheets/` if approved for repository storage.
4. Run `node scripts/food-artwork/verify.mjs` to assert all 36 RGBA PNG assets exist, have the correct dimensions, and no duplicates or unexpected files.
5. Compare the actual image rendering on light (#FFFFFF with contrasted #F8F5E9 card) and dark (#111111 with contrasted #262626 card) surfaces. Check for edge artifacts and legibility at menu-thumbnail size.
6. Change `status` in the manifest to `assets-imported`, then mark PR ready for review. Keep this as an artwork-only PR.

### Important format note

The user asked for editable SVGs originally, but the approved sheets were AI-generated raster images. The files in the ZIP are **real separated transparent PNGs** and must not be disguised as vector SVGs. Native paths-only SVGs require a follow-up human-reviewed vectorization stage.

### Future application contract (not implemented in this PR)

Merchant-uploaded dish photography wins; otherwise an explicit merchant-selected illustration; otherwise an appropriate categorized illustration; otherwise a neutral fallback. Existing sold-out imagery treatment continues. No category image or icon may imply a verified allergen or religious certification. No app runtime changes in this staging PR.

### Scope and CI

Only documentation and a standalone Node.js verifier are introduced here. The existing menu, ordering, and UI are unchanged. Do not enable the verifier in CI until the actual assets are committed.
