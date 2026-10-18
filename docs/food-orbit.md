# Food Orbit — homepage artwork handoff

Issue #80 · design direction: owner-selected **Concept F**. Source: \`src/components/marketing/hero/food-orbit.tsx\`; styling: \`food-orbit.css\`; integration: \`src/app/page.tsx\`.

## Artwork and functionality

Original native SVG paths with individually composed pizza, coffee, biryani-style rice bowl, layered dessert, mobile menu mockup, decorative/non-scannable QR table sign, ingredient details and hand-drawn orbital paths. The phone depicts **Free QR Menu browsing only**—no unlaunched ordering, KDS, promises about actual dishes, dietary data or prices. The decorative QR glyph has no implied destination: use the actual /demo link to test a working QR.

The nine visual bands are atmosphere, outer orbit, rear ingredients, inner orbit, phone, three primary food illustrations, table sign, foreground garnish and interface highlights. CSS custom properties adapt to the theme-script-managed \`data-theme=light|dark\`; food maintains its natural colors. No base64, external imagery or paid provider. No migrations, service/API/QR identity changes or dependencies.

Motion: drawn path, staggered entrances, short phone overshoot, calm floating with independent tempos, steam-path animation. Pointer fine/hover devices get frame-limited \`--near-_\`, \`--mid-_\`, \`--far-*\` parallax. IntersectionObserver and document visibility pause ambient motion; listeners and rAF are cleaned up. Reduced motion renders the final static composition immediately. The illustration itself has a single accessible title/description and no focusable controls.

The homepage retains existing free product statements, /register and /demo actions and coming-soon cards. No shared globals or deployed asset replacement.

## Acceptance and evidence

Required: \`pnpm install --frozen-lockfile\`, \`pnpm lint\`, \`pnpm typecheck\`, \`pnpm test\`, \`pnpm build\`, and \`pnpm exec playwright test tests/e2e/food-orbit.spec.ts tests/e2e/phase4-marketing.spec.ts tests/e2e/styling.spec.ts\` against the branch head. Confirm 360/390/768/1024/1440px, Light/Dark/System, zoom, keyboard, reduced-motion, mobile touch, actual screenshot visual review and no overflow. Visual acceptance and four native ARM64 CI lanes must be observed before merging; an open PR is not deployed production code.

Rollback: revert this isolated marketing change, with no database rollback. Do not merge this visual slice as a substitute for Phase 4 operator-backed sign-off.
