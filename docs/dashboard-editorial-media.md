# MenuMinute Dashboard 2.0 — Editorial Media (PR A)

Production media for the approved Editorial Table dashboard. This PR is **media-only**; layout, KPIs and data integrations belong to later PRs.

> Publication status: The four verified compressed WebP files have been exported into a handoff archive but cannot be transferred as binary through the current GitHub connector. Keep this PR as a **draft** until the actual four binaries are added to `public/brand/dashboard/editorial/` and checked against the SHA-256 manifest.

| Asset | Pixels | Purpose |
| --- | ---: | --- |
| `hero-desktop-light.webp` | 2880 × 900 | Full-bleed light header with left copy-safe area |
| `hero-desktop-dark.webp` | 2880 × 900 | Matching espresso/charcoal header |
| `priorities-illustration.webp` | 700 × 500 | Transparent cutting board, handwritten napkin and olive leaves |
| `outlet-health-illustration.webp` | 400 × 480 | Transparent olive-oil cruet and botanical leaves |

App assets total **518,312 bytes** (about 506 KiB). Exact bytes and SHA-256 are listed in `public/brand/dashboard/editorial/manifest.json`.

## Usage and acceptance

- Render hero as artwork filling the workspace width, **not** inside a rounded card. The existing dashboard's outer `max-w-6xl` and padding should be exempted in the future implementation PR.
- Overlay live heading, buttons, name, statuses, KPIs and tooltips as semantic HTML. No text, clickable control or fake sample QR code is baked into hero art.
- Choose the correct hero for resolved light/dark theme, never invert food imagery with CSS. Provide a solid fallback and contrast-preserving copy overlay.
- Display transparent supporting artwork only as decoration: `alt=""` or `aria-hidden`. The napkin's phrase is decorative and conveys no required instruction.
- Keep original MenuMinute identity, Ink & Ember component contract, and outlet-scoped publishing logic; refer to `docs/brand-assets.md` and `docs/design-system.md`.
- Use responsive crop and check narrow layouts; separately recomposed mobile banners are **not** in this four-asset scope.
- Verify dimensions, WebP decoding, alpha, bytes and SHA-256 from the manifest. No new runtime dependencies, migrations, or deployment changes in PR A.
