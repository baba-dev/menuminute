# home-v2: "Upload. Review. Live." (section 4)

Status: **built and previewed** at `/home-v2` (`noindex`, not in the sitemap), after
[the kitchen board](home-v2-kitchen-board.md). It is a scripted marketing preview with a sample menu:
no file is uploaded or processed and no AI runs on the page.

## Story

A restaurant already has a menu on paper or as a PDF. The section shows the product's real rule for
turning it into a live QR menu: the scanner drafts it, the owner confirms every dish against the source,
and only the owner publishes.

## Behaviour

1. **Upload.** A printed sample menu (`sample-menu.pdf`) is read line by line with a scan laser. It starts
   by itself when the section is seen, or on "Upload the sample PDF".
2. **Review.** Four draft rows. One price is flagged "Needs attention" (the source reads `4O9`, drafted as 409) and one is "Price unreadable" (smudged). Hovering or focusing a row highlights the source line it
   was read from. Unreadable prices must be typed before that dish can be confirmed; editing a confirmed
   price re-opens it. Progress is "n of 4 confirmed" with a rolling number and bar.
3. **Publish.** "Publish menu" stays disabled until every dish is confirmed and the page says what still
   blocks it. Publishing reveals the live menu with a "Live" pill and a permanent QR (server generated).
   Reset restores the draft.

The rules live in pure, unit-tested `pdf-to-menu-logic.ts` and mirror `src/modules/menu-import/review.ts`
(candidate data is untrusted; every included dish and price needs review; confirm everything before
finalising). They are a marketing mirror, not an import of product code.

## Copy and honesty

- Source claims: the owner help article (`/help/owner/ai-menu-import`) says photos (JPEG, PNG or WebP; PDF is not supported by the real importer, only this scripted demo uses a sample PDF), a private
  candidate draft, never published automatically, reviewed and accepted by the owner.
- Availability: the owner confirmed AI import is open to every outlet, so the third card says so and links
  to sign-up. Note that `/pricing` still says "AI photo import where separately enabled and approved";
  that page was out of scope here and should be updated separately so the site agrees with itself.
- The note says it is a scripted preview with no upload and no AI, and that dish details are never
  verified claims. The sample paper carries no allergen or dietary claims.
- Prices are whole rupees from 0 to 99,999; the unreadable-price input only accepts digits.

## Accessibility and fallbacks

- Real controls with specific labels ("Confirm Biryani", "Price in rupees for Amritsari Fish"); steps use
  `aria-current="step"`; status always has a word; a polite live region announces upload, scan end, publish
  and reset. Blockers are exposed through `aria-describedby` on the publish button.
- `prefers-reduced-motion: reduce`: no beam, laser, shimmer, roll or transitions; the section goes straight
  to review, and every control still works.
- Without script nothing is hidden (script only adds reveals); the flow needs script.

## Shared piece

`src/components/marketing/shared/use-section-motion.ts` returns `{ ready, reduced, visible }` and marks
`[data-reveal]` elements on first view. Section 4 uses it; sections 2 and 3 still carry their own copy of
the same effect and can move to it later (not done here to keep this change scoped).

## Files

- `src/components/marketing/pdf-to-menu/` (`pdf-to-menu.tsx`, `-logic.ts`, `-fixture.ts`, `.css`)
- `src/components/marketing/shared/use-section-motion.ts`
- Mounted in `src/app/home-v2/page.tsx` (receives the same server-generated `qrDataUrl` as section 2);
  `.pm-container` joins the shared grid in `src/app/home-layout.css`.

## Verification (last run)

- `tests/pdf-to-menu.test.ts`: 11 tests (price parsing, seeded flags, confirm and edit rules, publish gate,
  blockers, status words, steps, immutability, links against the help and docs registries, honest copy),
  run with a DB-free vitest config because the global setup needs a migration database.
- `tests/e2e/home-v2-pdf-to-menu.spec.ts`: 7 scenarios on desktop and Pixel 5 (14 runs): upload to review,
  unreadable price gate, publish gate and live state, source highlight, honest copy and links, overflow and
  axe WCAG 2 A/AA, reduced motion.
- Sections 1 to 3 specs still pass. `tsc --noEmit`, eslint and prettier are clean for the changed files.
  The full `next build` needs real production configuration and was not run here; CI covers it.

Section 5, [the trust section](home-v2-trust.md), follows it.
