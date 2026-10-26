# Ink & Ember: production artwork handoff for PR #191

All **26 original images/icons** in `Imagework.zip` have been inventoried. The original **26 binary assets are already committed** on this PR in commit `925a545` (Added mediawork). All 26 are now referenced by the onboarding screens, with inline fallbacks for future missing assets.

## Upload instructions (already completed on this branch)
1. Open PR #191 branch `feat/customer-onboarding` in GitHub, not `main`.
2. Unzip the prepared `MenuMinute-Onboarding-Media-GitHub-Upload.zip`. Keep the paths.
3. Commit WebP images to `public/brand/onboarding-wizard/`.
4. Commit all six `outlet-type-*.svg` into `public/brand/onboarding-wizard/icons/`.
5. Verify the filenames against `manifest.json`, run CI, then review each screen in both light and dark modes.

**Do not upload the zip file as a public static asset.** The repository must contain individual files. The user-facing ZIP is optimized for GitHub uploads (1.2 MB vs. original 11 MB).

## Full integration map
- Five wizard step heroes × 2 themes: `wizard-hero-<step>-<light|dark>.webp` (step: identity, location, operations, contact, launch)
- Welcome hero desktop and mobile × 2 themes: `welcome-hero-<device>-<theme>.webp` — `/onboarding`
- Six outlet-type vector SVGs: `icons/outlet-type-<type>.svg` — identity selection
- GPS locator × 2 themes: `gps-locator-<theme>.webp` — location step
- Empty outlet × 2 themes: `empty-outlet-<theme>.webp` — first-visit empty dashboard
- Celebration overlay × 2 themes: `celebration-overlay-<theme>.webp` — `/dashboard/get-started`

The CSS theme selector is `html[data-theme="dark"]`, following the app's appearance toggle. The visual fallback never blocks forms or redirects, and your media artwork does not embed guest QR codes, which are generated dynamically.

These uploaded files were verified in GitHub's commit listing. No need to upload them again unless updating an illustration.

No paid entitlement is activated by these illustrations, by choosing a setup goal, or by completing onboarding.
