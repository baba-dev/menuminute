# Public menu: personalized outlet storefront

Guest-facing MenuMinute menus now reuse the published outlet's existing profile. No new
tenant profile table or separate public contact endpoint is required.

## Guest-safe data

- Migration 0079 extends `app_private.free_menu_public` with a bounded `outlet.profile`.
  Active QR, outlet publication and organization checks remain in place.
- Private operations contacts, account recovery information, organization settings,
  credentials and internal user data are never projected.
- Profile changes already invalidate Redis menu caches. The guest API ETag includes
  the public profile after the next fresh read; old payloads remain supported.
- Invalid/missing contact fields never generate unsafe guest links.

## Navigation and experience

- The hero shares its left gutter with the body and exposes published categories.
  Category IDs include their menu identity, and links honor current search/diet filters.
- The compact sticky navigator appears when the cover leaves the viewport.
- Phone, email, website and Google Maps directions are available when configured.
  No guessed opening-hours status or unapproved remote imagery is displayed.
- Menu Studio's preview uses the exact same guest component, including the safely
  projected profile. Draft menu edits remain private.

## Release verification

1. Run migration 0079 before switching to the updated frontend.
2. Run Prettier, ESLint, TypeScript, Vitest, production build and Playwright.
3. Inspect 320, 360, 390, 768, 1024 and 1440px in light/dark mode and text zoom.
4. Verify search, dietary filters, category anchors, concierge, checkout, PWA/offline
   refresh, translations, multiple releases, legacy menus and QR revocation.
5. Leave this PR unmerged until checks and visual QA pass.
