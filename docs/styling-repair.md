# Tailwind compilation repair

Issue: [#23](https://github.com/baba-dev/menuminute/issues/23).

The deployed homepage contained Tailwind utility classes but rendered its primary
action as an unpadded inline blue link. The repository imported Tailwind 4 in
`src/styles/globals.css` and installed `@tailwindcss/turbopack`, but did not register
the loader. Next.js could build and serve CSS without generating Tailwind utilities.
Earlier text-only browser checks did not detect that failure.

`next.config.ts` now registers the existing locked Turbopack loader for CSS, following
its packaged README. Both standard `next dev` and `next build` use this configuration.
There are no dependency, database, authorization or infrastructure changes. A custom
Webpack build is not covered by this integration.

`tests/e2e/styling.spec.ts` checks the production homepage's computed CTA display,
spacing, radius, text/background colors, responsive heading size and desktop/mobile
navigation visibility in the existing ARM64 standalone browser suite. It must fail
if Tailwind compilation is disconnected, even when HTTP and content checks pass.

The dark surface compatibility rule also covers `bg-white/80`, used by the marketing
navigation. Without that addition, restoring utilities exposes a translucent white
navigation behind light text in dark mode. Browser checks cover dark navigation,
heading contrast, preference persistence on reload and switching back to light.

This restores existing utility-based UI. It does not claim that the older marketing
pages fully implement the approved Ink & Ember direction. That design refinement
remains separate from this compiler repair.

## Release and rollback

Require all four final-commit ARM64 CI lanes and independent diff review. Publish the
immutable ARM64 artifact using the existing workflow, then install it through the
existing operator release procedure. The publishing workflow does not deploy to the
VPS. Verify the homepage visually and inspect CTA styles after cutover. Rollback uses
the previous release artifact; no migration or data rollback is needed, though the
previous artifact retains the styling defect. Keep ERP services untouched.
