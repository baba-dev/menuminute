# Section 4 — The Order Conveyor

Status: original Direction B artwork approved for homepage inclusion. This is a **future ordering concept preview**; it does not submit orders, show a live payment gateway, or enable ordering entitlements.

## Integration

- Component: `src/components/marketing/order-conveyor/order-conveyor.tsx`
- CSS: `src/components/marketing/order-conveyor/order-conveyor.css`
- Trusted inline artwork strings: `src/components/marketing/order-conveyor/order-conveyor-art.ts`
- Editable original assets: `public/marketing/order-conveyor-desktop.svg` and `public/marketing/order-conveyor-mobile.svg`
- Homepage placement: after MenuAlchemy (Section 3), before the product choices section.

The desktop SVG has viewBox 1440 × 620; mobile SVG is independently composed at 420 × 880. The illustrations are controlled by the existing html[data-theme] attribute, IntersectionObserver and document.visibilityState. Only approved static SVG strings are rendered as inline HTML; never replace these with dynamic/user-provided markup. Both SVGs have unique oc[d/m]-prefixed internal IDs. The `oc-play` class is removed from source insertion to keep a complete static end frame for no-JS and before intersection; visibility triggers the 8.2-second CSS timeline once. Replay restarts by removing and re-adding the class. Reduced-motion preference shows the final illustration and disables Replay.

Accessibility: the illustration is presented once by its surrounding role=img label; internal SVGs are aria-hidden. Explanatory HTML and planned-feature labels are readable without animation or colour. Do not add another navigation landmark or duplicate the existing exact `In development` badges.

Scope boundary: future dine-in/pickup, guest basket, request, merchant acceptance. No online payment, courier delivery, working preview checkout, staff API or commercial price claim. Links use current /pricing and /register pages. No new dependencies.

## Gate

Run native ARM64 CI: formatting/lint, strict TypeScript, real PostgreSQL and Redis integration, production build plus Playwright, and aggregate gate. After merging, separately verify main SHA CI, immutable artifact publication, VPS staging/eligibility, activation and public HTTPS readiness; do not infer activation from PR merge.
