# Approved original dish artwork

This collection contains 36 separate 360 × 280 transparent PNG illustrations.

- Indian dishes: 12 files.
- Western dishes: 12 files.
- Italian dishes: 12 files.
- [Browse the labeled artwork](gallery.md).
- [View the canonical asset manifest](manifest.json).

The original AI-rendered review sheets were raster images, not editable vectors. These files are
real transparent PNGs, not faux SVG wrappers. Genuine editable SVG masters would require a
separately reviewed vector redraw.

The accompanying review ZIP contains the three original reference sheets, individual files,
light and dark previews, SHA-256 checksums, and the reproducible extraction script.

## Verification before merging

1. Run `node scripts/food-artwork/verify.mjs`.
2. Check all individual crops in the [gallery](gallery.md).
3. Inspect the light and dark comparison previews on contrasted Ink & Ember cards.
4. Confirm the dish labels and visual appearance with the product owner.
5. Require all repository CI lanes to pass on the final commit.

No runtime behavior changes in this PR. Existing merchant photos and sold-out behavior are
untouched. A later integration can prefer owner photographs, then owner-selected illustrations,
then a suitable dish or category illustration, followed by a neutral placeholder.

Never imply a verified allergen or religious certification based on artwork alone.
