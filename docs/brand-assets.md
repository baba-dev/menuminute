# MenuMinute brand assets — v1

Approved product mark: orange menu-book with clock, **MenuMinute by BabaBuilds**. This is separate from the restaurant-specific menu artwork. All paths below are relative to `public/`, and are directly served at `/<path>`. Keep the variant matching its background (light = dark text; dark = white text).

| Use | Asset path | Format / behavior |
| --- | --- | --- |
| Header (light / dark) | `brand/motion/logo-reveal-{light,dark}-nav.svg` | Cropped transparent SVG, 660×156; 2.4 s once, holds last frame |
| Full-size motion | `brand/motion/logo-reveal-{light,dark}[-transparent].svg` | Original approved 960×300 SVG |
| Static header / fallback | `brand/logos/logo-horizontal-{light,dark}.svg` | Outlined vector mark, no font/network dependency |
| Square product symbol | `brand/icons/icon-master.svg` | Standalone menu-clock emblem |
| Browser favicon | `brand/icons/favicon.svg` and `src/app/icon.svg` | SVG; not a PWA install asset |
| Brand concepts, stickers and QR | `docs/brand-assets.md` / original approved artwork | Design reference only; mock QR is **not** a functional code |

## Motion interaction contract

`src/components/marketing/brand/brand-nav-logo.tsx` observes the resolved `html[data-theme]` attribute, as managed by existing ThemeSync. It server-renders a static fallback and mounts the relevant external transparent SVG after hydration. `key={mode}` means **one play on initial mount, hold at final frame, replay only on a resolved-theme change**. Do not change key on normal renders or loop CSS. The parent home link provides the accessible name, and the decorative SVG is hidden from assistive technology. The SVG itself honors `prefers-reduced-motion` and shows the final logo without transition. Test light, dark, theme changes, mobile and reduced motion.

## Scope / handoff

Do not integrate or replace the PWA manifest, Apple touch icon or maskable PNGs in this PR: owner requested these later. Do not use storyboard or generated sticker-board sample QR pixels as working QR codes: real outlet URLs must be encoded by the product QR generator and scanner-tested before print. Raster artwork should be exported as WebP, vector marks/motion as SVG. Sticker designs are conceptual until correct dimensions, bleed, real destination and print proof are supplied. Original brand package and motion package remain the approved masters; the cropped nav copies are deliberate display derivatives.
