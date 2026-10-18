# Menu Alchemy — marketing Section 3

A planned-feature, illustrative nine-second motion composition after the existing Food Orbit and Menu Journey. This is not an OCR implementation, stock-photo integration, import endpoint, or public promise of automatic publication.

- Artwork is original, static, trusted inline SVG markup adapted from the owner-reviewed prototype. There are no embedded scripts or user-supplied strings in `alchemy-artwork.ts`.
- `alchemy-motion.ts` renders the approved deterministic stages using one requestAnimationFrame clock, bounded deltas and element queries scoped to the artwork instance.
- The initial and no-JavaScript state shows the completed illustration. Once sufficiently visible, motion starts once, pauses offscreen/on hidden tabs, resumes when appropriate, and has explicit pause/replay controls.
- Reduced-motion mode shows the completed static scene. An alternate vertical HTML illustration preserves legible dish names and prices at phone sizes; it uses the same staged state.
- The section truthfully labels smart image/PDF import as *coming soon*. It links to the available manual Free QR Menu onboarding, not to a nonexistent import route.
- New assets and styles are scoped. There are no changes to schema, AI provider integrations, menu authorizations, entitlements or deployment workflows.

## Release verification

Run the unchanged CI quality, strict TypeScript, PostgreSQL/Redis integration, production ARM64 build/browser, and required aggregate gate at the final PR head. Browser checks cover hero and Journey retention, section order, semantic copy, links, playback, 320px overflow, themes, and reduced motion. After merge, independently verify the main CI, publisher, activation and public readiness SHA; merge alone does not prove production activation.
