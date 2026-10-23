# Dining Canvas — D–H implementation and release gates

PR C introduced four static restaurant covers and six transparent category images; this release integrates them into the actual public QR menu and Menu Studio. The published menu document stores optional \`presentation\` values for cover, headline, and up to eight merchant-selected dish IDs. No schema migration or QR-token rotation is needed; unconfigured historical documents get a conservative default.

- D: food-first cover, category navigator, responsive dish cards, browse-only detail actions, dietary filters and empty states.
- E: visual product sheets, required choices, availability checks, modal keyboard/focus and scrolling behaviour.
- F: cart photography and optional merchant-curated recommendations, strict session rehydration, server-authoritative price submission, accurate pending/acceptance wording.
- G: Storefront editor controls and a real private preview using the same guest UI; unsaved changes never reach published QR menus.
- H: bounded image fallback, approved-only public artwork index, review ledger validation, accessible focus, motion preferences, narrow viewport layouts, metadata, unit/Playwright coverage.

## Security and operational invariants
No external merchant-provided image URLs: only hard-coded cover/category paths, checked local catalogue paths and existing authorized media endpoints. The 36 original illustrations are the initial proposed approved baseline; 188 other imported illustrations remain blocked from automatic guest usage. Owner visual sign-off of the original collection and image QA in both themes are required before merge.

The public QR revocation and published-release RLS remain enforced by the existing service; order API re-quotes the submitted IDs/variants/add-ons and is the sole authority for prices. Client storage must not be trusted. An order is not accepted until the restaurant explicitly acknowledges it. The menu does not imply unverified tax, allergen, best-seller or promotional information.

## Required release gate
1. Reconcile with latest main and retire/rebase overlapping draft PR #149 only after comparing its remaining scope; do not merge both changes blindly.
2. Four required CI lanes including strict TypeScript, prettier/lint, PostgreSQL/Redis tests, ARM64 production build and Playwright.
3. Inspect desktop/mobile at 320, 360, 390, 768, 1024, 1440px, light/dark, reduced motion; verify accurate crop and readability.
4. Verify browse-only, ordering, sold-out, service windows, QR revocation, missing image fallback, published-vs-private preview, direct checkout, payment wording and KDS acceptance.
5. No automatic merge/deploy until CI and owner visual QA pass.
