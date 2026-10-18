# Food Orbit — homepage artwork and release handoff

Issue #80; PR #81. Owner-selected direction: **Concept F — The Food Orbit**.

- Original layered SVG: `src/components/marketing/hero/food-orbit.tsx`
- Motion, theme and hero styles: `src/components/marketing/hero/food-orbit.css`
- Public homepage integration: `src/app/page.tsx`
- Browser tests: `tests/e2e/food-orbit.spec.ts` and the relevant styling/marketing suites

## Product-accurate artwork

Original native SVG paths depict pizza, coffee, rice bowl, cake, a stylized Free QR Menu phone, independently moving ingredients/steam/orbital paths and a decorative, **non-scannable** QR sign. The actual working QR is accessed through the unchanged `/demo` link. The screen does not suggest unreleased ordering/KDS, invented dish prices or dietary/allergen claims. No raster wrappers, external artwork requests or provider billing.

## Final hero layout

At >=1280px the animated SVG occupies the true middle grid column, with identically sized left and right support columns. The left column has the headline, clear free-product value proposition and functional `/register` and `/demo` CTAs; the right column explains Create / Display / Explore. The primary CTA uses the approved Ink & Ember gradient with dark foreground. Below desktop, copy and actions precede the centered art; narrow mobile crops minor peripheral detail while retaining the phone and food. Light canvas is white; dark canvas is charcoal. Food stays naturally colored. The rest of the public homepage and the development labels remain unchanged.

## Animation and accessibility

Nine bands: atmosphere, outer orbit, rear food, inner orbit, phone, primary food, table sign, foreground ingredients and highlights. Drawing paths, staggered entrances, gentle ambient float and steam use CSS. Desktop fine-pointer parallax is bounded and frame-limited via `--near-x` / `--near-y`, `--mid-x` / `--mid-y` and `--far-x` / `--far-y`. Offscreen/hidden content pauses; cleanup disconnects observers/listeners and animation frames. `prefers-reduced-motion: reduce` displays complete static art immediately. The illustration is a single labeled SVG with no focusable controls. Primary actions remain in normal page flow.

## Validation and activation

Required on the **final PR head**: frozen-lockfile install; Prettier/lint; strict typecheck; PostgreSQL/Redis integration; production ARM64 build and Playwright; aggregate quality gate. Browser tests explicitly cover all 360/390/768/1024/1440 widths, center placement at 1440, theme persistence, reduced motion, CTA targets, ordering/price claim safety, and no horizontal overflow. Independent visual acceptance of both themes is also required.

No schema, migration, server config, auth, billing, QR identity, ordering or worker changes. The previous passing CI on `0573f50e13cea009a27579baf6c4c40a8eb57060` is **superseded** by the final amended commit and cannot authorize merging on its own. Merge does not equal activation: the latest-main native ARM64 publisher, checksum-verified stage, unchanged-migration guard, production environment review (if configured), ERP health and exact public release SHA must all succeed. Rollback is a compatible application release, not a data rollback. Phase 4 operator/backup/restore/ERP gates remain separate.
