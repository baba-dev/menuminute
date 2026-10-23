# Public Menu 2.0 — Visual asset staging (PR C)

This PR creates the upload structure for the **10 generated** Ink & Ember / Dining Canvas assets: four panoramic outlet covers and six transparent category illustrations. It intentionally does not include any binary images or change the public menu runtime. [PR #149](https://github.com/baba-dev/menuminute/pull/149) is the A/B foundation; the later visual UI integration is a separate step.

## Upload workflow

1. Download **menuminute-public-menu-assets-v1.zip** from the associated ChatGPT conversation, then extract it.
2. Check out branch `feat/public-menu-2-visual-asset-scaffold` (or use GitHub's file-upload UI on that branch).
3. Copy **only the contents** of `upload-to-repo/` into the repository root, preserving the paths under `public/assets/public-menu/`. The ZIP includes all 10 optimized WebP images with exact expected names.
4. Keep `source-png/` as the high-quality archive; these 10 masters are not needed in the repository or initial release.
5. Run `node scripts/verify-public-menu-assets.mjs --strict` to verify all 10 file hashes, byte sizes, pixel dimensions, WebP format and true category transparency.
6. Review all imagery in both themes and mobile/desktop crops, obtain owner approval, rerun CI on the uploaded head, and only then mark the PR ready.

The directories retain `.gitkeep` files to make the scaffold visible before image uploads. These can remain or be removed when binaries arrive.

## Expected directories

```text
public/assets/public-menu/
  covers/
    artisan-bakery.webp
    cafe-coffee.webp
    indian-restaurant.webp
    street-food-cloud-kitchen.webp
  categories/
    starters-snacks.webp
    main-courses.webp
    rice-biryani.webp
    breads.webp
    desserts.webp
    beverages.webp
```

The exact file list, SHA-256 checksums, dimensions and source-PNG provenance are defined in `docs/public-menu-assets/manifest.json` and match the distributed ZIP manifest.

## Presentation rules

- Covers are 2172 × 724 and leave generous **left-side text-safe space**. Add outlet identity as accessible HTML/CSS overlays, never bake merchant names or prices into the raster.
- Categories are 1254 × 1254 with real alpha transparency. Use `object-fit: contain` and explicit foreground/background contrast in light and dark themes.
- These are **category illustration concepts** rather than representations of an outlet's actual dishes. The main-course and rice/biryani compositions contain meat; never display them as evidence of vegetarian, vegan, halal or allergen status.
- Merchant-uploaded approved real photographs always have precedence over decorative artwork. No automatic artwork assignment, commercialization, or menu changes in this scaffold.
- Pending files must not appear on the live public menu before upload, review and separate UI integration.
- This package contains the ten images actually generated, not the additional designs in the wider asset plan.
