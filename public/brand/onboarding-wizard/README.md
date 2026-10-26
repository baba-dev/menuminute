# MenuMinute Onboarding 2.0 — Media Production Handoff

Artwork for `/onboarding` and the first-outlet wizard modal follows the existing Ink & Ember design:
**Light = warm ivory and ink; dark = obsidian and amber.**

## Required stage illustrations — 10 files

Create each scene in **1200 × 720 (5:3)**, preferably transparent or carefully blended WebP. If created as SVG instead, use a **400 × 240** viewBox and commit the corresponding SVG files alongside the artwork manifest.

| Stage | Light file | Dark file | Art direction |
|---|---|---|---|
| Identity | `wizard-hero-identity-light.webp` | `wizard-hero-identity-dark.webp` | Elegant restaurant storefront and warm sign |
| Location | `wizard-hero-location-light.webp` | `wizard-hero-location-dark.webp` | Isometric map with precise restaurant location |
| Operations | `wizard-hero-operations-light.webp` | `wizard-hero-operations-dark.webp` | Chef cloche, clock, service schedule |
| Contact | `wizard-hero-contact-light.webp` | `wizard-hero-contact-dark.webp` | Dining table and QR stand |
| Launch | `wizard-hero-launch-light.webp` | `wizard-hero-launch-dark.webp` | Celebratory golden cloche and confetti |

These exact 10 WebP paths are wired into `WizardMediaSlot` with inline SVG fallback. The component reads `document.documentElement.dataset.theme` through CSS selectors, in line with MenuMinute's appearance toggle.

## Optional supporting artwork — 15 files

- `onboarding-welcome-desktop-light.webp` / `-dark.webp`: **1440 × 960**
- `onboarding-welcome-mobile-light.webp` / `-dark.webp`: **720 × 960**
- `type-restaurant.svg`, `type-cafe.svg`, `type-takeout.svg`, `type-cloud-kitchen.svg`, `type-hotel.svg`, `type-mixed.svg`: **48 × 48**, `currentColor` tintable icons
- `gps-location.svg`: **400 × 400**, vector
- `empty-outlet-light.webp` / `empty-outlet-dark.webp`: **480 × 360**
- `setup-complete-badge.svg`: **160 × 160**, vector
- `completion-celebration.svg`: **800 × 480**, vector

The optional assets are a prepared handoff, **not automatically inserted into the current wizard**. They should be integrated where they improve the UI after final media approval.

## Safe production assets

- Center the main subject inside a 70% safe zone. Avoid text, actual QR data, buttons, and field labels.
- Keep raster exports in sRGB; aim for **under 180 KB per stage asset** where visual quality permits.
- Avoid sensitive information embedded in graphics. Any SVG must use sanitised, trusted markup.
- Preserve filenames and transparency. Do not replace onboarding with a standalone dark-only look.
- Test the final illustrations on mobile (375 px) and desktop (1440 px), light and dark.
