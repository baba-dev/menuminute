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

## Dish cards, brand mark and checkout details

- `dish-card.tsx` renders each dish card. It has a verified-rating slot that stays hidden until a
  rating aggregate is supplied (no review data exists yet) and a "Customize & add" button when a
  dish has variants or add-ons.
- The cover shows the approved MenuMinute light reveal as an `<img>` (`dining-brand-mark.tsx`).
  The site CSP sets `object-src 'none'`, so an `<object>` embed is blocked; SVG animation still
  plays in `<img>`.
- Checkout details (`guest-details.tsx`, `src/modules/orders/guest-profile.ts`): the phone is
  validated inline (8 to 15 digits) and sent cleaned; name, phone and instructions stay optional.
  "Remember my name and phone on this device" is unticked by default and stores name and phone in
  localStorage for up to 90 days; instructions are never stored. This is an interim, device-local
  convenience, not a server profile, and the server remains the validation authority.

## Release verification

1. Run migration 0079 before switching to the updated frontend.
2. Run Prettier, ESLint, TypeScript, Vitest, production build and Playwright.
3. Inspect 320, 360, 390, 768, 1024 and 1440px in light/dark mode and text zoom.
4. Verify search, dietary filters, category anchors, concierge, checkout, PWA/offline
   refresh, translations, multiple releases, legacy menus and QR revocation.
5. Leave this PR unmerged until checks and visual QA pass.
