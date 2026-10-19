# MenuMinute — approved brand asset registry

This is the canonical source of reusable product branding. The identity is **MenuMinute by BabaBuilds**: Ember Orange `#FF4B0A`, Warm Amber `#FF8A00`, Ink `#15171B`, Cream `#FFF8F0`. These brand colors supplement (not replace) the semantic Ink & Ember application tokens. No fonts are bundled.

## Asset map

All URLs below are individually addressable relative to `public/` and may be used by components without unpacking an archive.

| Need | Asset path | Format / behavior |
| --- | --- | --- |
| Approved horizontal logo | `/brand/logos/menuminute-horizontal-{light,dark}.svg` | SVG, logo + endorsement; selects background-appropriate variant |
| Wordmark / stacked | `/brand/logos/menuminute-wordmark-{light,dark}.svg`, `menuminute-stacked-{light,dark}.svg` | SVG |
| Compact final logo | `/brand/logos/nav-{light,dark}-static.svg` | Font-independent path outlines; no motion |
| Official symbol and favicon | `/brand/icons/icon-master.svg`, `/brand/icons/favicon.svg` | SVG; `src/app/icon.svg` is an App Router metadata entry |
| Full motion reveal | `/brand/motion/reveal-{light,dark}.svg` | SVG; 2.4 seconds, full stage/background |
| Transparent reveal | `/brand/motion/reveal-{light,dark}-transparent.svg` | SVG; full lockup |
| Nav-optimized reveal | `/brand/motion/nav-{light,dark}-transparent.svg` | SVG; cropped to preserve legibility |
| Small-purpose loaders | `/brand/loaders/{clock-needle,menu-lines,ember-orbit,three-dot,progress-indeterminate}.svg` | SVG; loop; reduced-motion fallback |
| QR centre mark | `/brand/print/qr-centre-mark.svg` | SVG, white quiet-zone backed |
| Editable restaurant stickers | `/brand/print/sticker-{primary-portrait,circular,door-cling,premium-window,opening-hours}.svg` | SVG print templates; replace placeholders |
| Product preview graphics | `/brand/social/` | WebP exports when available; never crop a design board for a live logo |

**PWA icon set, Apple Touch images, Web App Manifest, install screenshots and splash-image implementation are intentionally deferred** until product-owner approval. This PR does not silently change or advertise a new PWA manifest.

## Public navigation behavior

`src/components/marketing/animated-nav-brand.tsx` renders the cropped transparent logo from `motion/nav-*`. A theme-correct static SVG is shown on first paint, then the revealed asset mounts once. The external SVG animates for 2.4 seconds, with `animation-fill-mode: both` holding the last frame. `MutationObserver` observes the resolved `html[data-theme]` value already set by the existing pre-hydration theme script. **Only a resolved light↔dark change remounts/replays** the SVG; other navigation state does not. System-mode changes that actually change the resolved color count as theme changes. It observes `prefers-reduced-motion` inside the SVG and shows the final frame without animating. Do not introduce random URLs, infinite replay, timers, localStorage overrides, or a new theme provider just for the logo.

## Safe print / QR use

The QR concept illustrations and editable sticker templates are **not active QR codes**. Their clearly marked `LIVE QR / INSERT AT PRINT TIME` area must be replaced with the *real outlet-specific QR* from the application's QR generation service; test with at least two phone cameras before going to print. Maintain high contrast, a proper ISO quiet zone, adequate module size and device-validated error correction after the centre mark is inserted. Do not place a logo over a code before validating scannability. Restaurant hours and ordering claims must come from each merchant's actual configuration; demo wording cannot be automatically promoted as fact.

## Source/version rules

- Public marketing images should be optimized to WebP; keep SVG for animation, vector logo, icons and print templates.
- Keep dimensions intrinsic in SVG; prefer `next/image` or `img` at fixed aspect ratio to avoid layout shift.
- Reuse these canonical names, not ad-hoc copies or derived screenshots. For graphic edits, increment version and validate both modes.
- Preserve the original full-stage animated reveal separately from the navbar crop; they serve different contexts.
- The identity board, sticker-design board, and motion storyboards are **visual references**, not production assets to crop or encode as QR payloads.
