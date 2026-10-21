# Menu Studio 3.0 — Recipe Atelier artwork (PR A)

This directory is the final destination for the seven compressed WebP assets. It currently contains an expected-asset `manifest.json`; **the image binaries are intentionally not yet committed**. Upload them using the attached ZIP, then mark the pull request ready. This is a media-only dependency for the Menu Studio 3.0 redevelopment, not a deployed interface change.

## Upload these exact filenames

| Asset | Pixels | Transparency |
| --- | ---: | --- |
| `hero-desktop-light.webp` | 2880 × 800 | Opaque |
| `hero-desktop-dark.webp` | 2880 × 800 | Opaque |
| `hero-mobile-light.webp` | 960 × 1000 | Opaque |
| `hero-mobile-dark.webp` | 960 × 1000 | Opaque |
| `first-menu-empty-illustration.webp` | 700 × 600 | True alpha |
| `dish-workspace-illustration.webp` | 600 × 440 | True alpha |
| `publication-celebration.webp` | 600 × 450 | True alpha |

**The two desktop banners preserve their previously approved exact bytes.** The two mobile exports are recomposed specifically for a portrait hero with top copy-safe space. The three spot illustrations are independent transparent WebPs, not screenshots or checkerboard backdrops. Image body/handwriting is decorative; all functional UI content stays live HTML.

## Upload to this PR branch

1. Download `menuminute-recipe-atelier-all-seven-media.zip` from the ChatGPT handoff and extract it locally.
2. On GitHub, select branch **`design/menu-studio-recipe-atelier-pr-a`**, not `main`.
3. Browse to **`public/brand/menu-studio/recipe-atelier/`** and choose **Add file → Upload files**.
4. From the extracted ZIP's matching folder, select **only the seven `.webp` files**, retaining their exact filenames. Do **not** upload the ZIP or `PREVIEW.jpg` to `public/`. The manifest and this README are already in the PR.
5. Commit directly to the same branch with message: `assets(menu-studio): add seven compressed Recipe Atelier WebPs`.
6. Verify the files using `node scripts/verify-menu-studio-media.mjs`, which checks the format, dimensions, transparency, byte count and SHA-256 recorded in `manifest.json`. Confirm CI on the full branch before marking this PR ready for review.

If any file differs from its manifest entry, use the unmodified ZIP export. Do not rename a PNG to `.webp`.

## Integration contract for PR B onward

- Public URL prefix: `/brand/menu-studio/recipe-atelier/`.
- Full-bleed hero background within the authenticated workspace rather than a rounded banner card. Switch art for light/dark from the existing pre-paint theme system.
- Recompose or use the mobile assets at narrow breakpoints (evaluate at 360 and 390px). Keep heading and action buttons in the text-safe upper section; validate actual copy at 200% zoom.
- Use spot artwork with empty alt text (`alt=""`) when surrounding copy already describes the state; do not bake critical instructions into art.
- Show the publication illustration **only after server-confirmed publication** with a separate semantic success announcement. Never treat image display as evidence of success.
- Maintain the existing menu authorization, saved-draft versus public-release separation, outlet scope, and media approval rules. This PR contains no changes to those contracts.
