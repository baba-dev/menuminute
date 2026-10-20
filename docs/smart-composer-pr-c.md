# PR C — Smart Composer Advanced Productivity

Bulk paste supports up to 50 staged dishes per batch, split by commas, semicolons or line breaks, with Unicode-aware duplicate protection. Select all is limited to the currently displayed ranked suggestions. Every new dish still needs explicit price (or Free), section and optional approved outlet photo review; adding changes only the private working draft.

Recently used suggestions are derived from the most recently inserted, nonarchived dishes in the current authorized menu, including saved edits across sessions. This is a recently saved menu heuristic, not an activity tracking log.

Organization reuse endpoint: GET /api/catalog/suggestions?menuId=<current-menu-id> authenticates the actor and selected outlet, verifies target menu access, and reads source menus with the existing menu_read RLS permission within the exact same organization. Capped at 40 source menus / 100 names. Returned payload is limited to name, category hint, source-menu label and display key. Prices, recipes, dietary fields and photos from other outlets are never carried over. Response is private, no-store. The merchant must enter their own price and choose an approved photograph in the current outlet.

Multilingual matching deterministically normalizes Unicode and a small curated Hindi/Arabic vocabulary, preserving unknown scripts without speculative translation or AI requests.

Artwork: docs/food-artwork/manifest.json still declares assets-imported-awaiting-owner-review. A per-asset state of approved plus a canonical local path is required before recommendation. This implementation uses illustrations solely as explicit visual previews, never as dish_media IDs, and never replaces approved restaurant photographs. No artwork suggestions show until the owner has reviewed assets and changed individual states. There is no automatic publication or media-rights bypass.

No new database migration or cross-outlet image permission is introduced. Verify exact-head ARM64 CI and browser tests before merge.
