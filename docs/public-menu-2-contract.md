# Public Menu 2.0 — A/B foundation

## Scope

This is the additive guest presentation contract and deterministic art resolution layer for the later Dining Canvas UI. It does not introduce a parallel menu, order, payment or media system. No schema migrations or QR token changes are required.

### Guest projection (v2)

`publicProduct(token)` still relies on `app_private.free_menu_public` and `public_ordering_enabled` for revocation, published releases and ordering entitlement. It strips archived categories/items before attaching `presentation`, an optional additive object for legacy/studio preview callers.

`presentation` has a stable `version: 2`, a `mode` of `browse` or `ordering`, a strictly limited identity (name, outletType, currency, point), and `categoryImages`/`dishImages` indexed by `<menuId>:<categoryId|dishId>`. Keys use the menu ID because different published menus can reuse local item IDs. It carries **no** nutrition, allergen, discount, ranking, checkout or private user/profile claims. Publication remains immutable and preview remains explicitly private.

### Guest media

Resolution order:

1. A dish's explicit `mediaId` uses the existing authorization-gated `/api/public-media/:id?size=thumb` endpoint.
2. If absent or unavailable in the browser, exact-normalized, **approved** local catalogue illustration.
3. Broad category-matched bundled SVG.
4. Bundled generic icon.

The guest runtime imports only the small `src/data/approved-dish-artwork.json` index, not the full manifest/dish-suggestion engine. CI verifies exact equality with the manifest's approved entries. Only canonical asset paths under `/assets/food/dishes/<category>/<slug>.png` with manifest `state: approved` qualify. Public assets on disk are not automatically approved, fuzzy names never silently substitute another food, and user uploads are not replaced or altered. The existing public media endpoint remains the security authority. The browser handles failed photos and illustrations with a deduplicated, bounded local fallback chain, always retaining the category fallback before the generic icon.

The original 36 assets are proposed as the baseline on the owner's directive to integrate their uploaded artwork; 188 later assets retain their pending statuses. Visual review of the original 36 is required before merging. Existing `scripts/food-artwork/verify.mjs` is part of the four-lane CI gate and checks files, dimensions, hashes where present, approval counts and recognized approval basis. Every future approval batch needs its own explicit verification-policy update.

### Future consumers

PR C adds cover and category artwork; D reworks the mobile/desktop menu; E/F add customization and checkout presentation; G adds merchant controls and faithful preview. None should infer promotional badges, safety labels or payment capability from decorative artwork.

### Regression

Test exact artwork selection, unapproved blocking, path validation, uploaded-photo precedence, category fallback, archived isolation, menu-qualified keys, browse vs ordering mode, preview fallback, 404/410 QR revocation, existing checkout and both themes.
