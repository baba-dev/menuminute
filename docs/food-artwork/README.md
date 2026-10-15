# Approved original dish artwork — Indian, Western, Italian

This PR contains **36 separate, labeled, 360 × 280 transparent PNGs**, extracted from the three owner-approved AI-rendered category sheets: 12 Indian, 12 Western, 12 Italian.

- See [the labeled GitHub gallery](gallery.md) and [canonical manifest](manifest.json).
- `public/assets/food/dishes/{indian,western,italian}/*.png` contains all 36 independent files. Slugs, intended accessible labels and paths are explicit.
- A separate conversation review ZIP includes the original approved source sheets, lossless individual PNGs, SHA-256 manifest, light/dark comparison previews and reproducible extraction script.
- All 36 PNGs retain real transparency (RGBA) and are *not* faux SVG wrappers. The AI-rendered sheets were raster concept art, not editable vector originals. A follow-up hand-reviewed paths-only SVG redraw would be needed to provide authentic vector masters.
- The assets are source artwork; **no production menu selection, owner-upload priority, sold-out behavior or theme logic is altered in this PR.**

## Required checks before merging

1. Run `node scripts/food-artwork/verify.mjs` (36 files, 360 × 280, PNG RGBA, exact naming).
2. Review individual crops in [gallery.md](gallery.md) and compare light (white + #F8F5E9 artwork card) and dark (#111111 + #262626 artwork card) previews included in the ZIP. Avoid illustrations blending into parent surfaces.
3. Confirm the original AI-rendered art faithfully represents the intended dish names; amend only if owner requests.
4. Run existing repository CI on the final PR SHA. Keep this artwork-only until approval.

## Later fallback contract (not implemented here)

Owner-provided actual dish photo > owner-selected illustration > appropriate category/dish illustration > generic illustration placeholder. Preserve Sold Out visible greyed image and accessible status text. Never infer a dietary/allergen or religious certification from food illustration alone. Avoid falsely representing a specific dish where only a category is known.
