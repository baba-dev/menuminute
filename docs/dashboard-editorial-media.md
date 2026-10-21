# MenuMinute Dashboard 2.0 — Editorial Media (PR A)

Production media for the approved Editorial Table dashboard. This PR contains the approved artwork and its asset manifest; UI, data and responsive optimisation are developed in PR B.

| Asset                             |     Pixels | Purpose                                                        |
| --------------------------------- | ---------: | -------------------------------------------------------------- |
| `hero-desktop-light.webp`         | 2880 × 900 | Full-bleed light header with left copy-safe area               |
| `hero-desktop-dark.webp`          | 2880 × 900 | Matching espresso/charcoal header                              |
| `priorities-illustration.webp`    |  700 × 500 | Transparent cutting board, handwritten napkin and olive leaves |
| `outlet-health-illustration.webp` |  400 × 480 | Transparent olive-oil cruet and botanical leaves               |

Four compressed WebP originals have been uploaded under `public/brand/dashboard/editorial/`. Their expected byte counts and SHA-256 values are in `manifest.json`.

The separately composed mobile source uploads are currently named `hero-mobile-light.webp.png` and `hero-mobile-dark.webp.png`; these contain PNG bytes. The Dashboard 2.0 implementation PR creates real, optimized 960 × 1120 WebP derivatives before dev/build and uses those derivatives at runtime.

## Usage and acceptance

- Display the hero full-width within the workspace, not in a rounded card.
- Keep heading, actions, outlet identity, KPIs, live state and tooltips as HTML, never baked into artwork.
- Respect resolved light/dark appearance without inverting the artwork. Keep left-hand copy readable.
- Small decorative illustrations should use empty alt text. The napkin text is ornament only.
- Keep canonical outlet-scoped publication state, Ink & Ember styling and real QR identities.
- See `docs/brand-assets.md` and `docs/design-system.md` for the approved app-wide system.
