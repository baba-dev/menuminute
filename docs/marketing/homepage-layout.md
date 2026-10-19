# Homepage editorial layout contract

The landing page shares an **80rem / 1280px content grid** across the hero,
sections 02–07 and the public footer. The content edge is controlled by
`src/app/home-layout.css`; the responsive gutter is
`clamp(1rem, 2.5vw, 2rem)` (1rem on mobile). Section rhythm is
`clamp(4rem, 6vw, 5.75rem)`, narrowing to 3.75–4.5rem on mobile.

The section headers share a 56rem measure, a 42rem supporting-copy measure and
one responsive h2 type scale. Footer CTA uses a deliberately smaller heading
to avoid feeling like another full hero. Major SVG/stage artwork can use an
internal maximum of 75rem without breaking the common outer grid.

**For future agents:** change the shared values in `home-layout.css` instead
of introducing a new hard-coded outer max-width in an individual marketing
component. Keep illustrations' own sizes, aspect ratios, playback behaviour,
interactive controls, and mobile SVG variants in their respective stylesheets.
Do not apply these homepage rules globally: dashboard, guest menus, demo,
legal and other public pages have independent layout needs. Footer link and
disclosure content lives in `public-footer.tsx`.

Regression coverage: `tests/e2e/home-layout.spec.ts` checks section/footer
left and right alignment, hero inner-edge alignment, headline-scale consistency
and horizontal overflow from 320px to 1920px. Run the existing homepage and
footer E2E suites alongside it in CI.
