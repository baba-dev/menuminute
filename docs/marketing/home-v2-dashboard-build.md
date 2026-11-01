# home-v2: scroll-assembled dashboard

Status: **the dashboard section is complete** at `/home-v2` (`noindex`, not in the sitemap): the shared
homepage nav bar, a first-frame wireframe and scroll cue, the real sidebar, top bar, hero, KPI row,
priorities, outlet health, Service Dispatch, dining floor, "At your service" and Today's pulse, the
new-order beat, per-chapter captions with links and a closing call to action. The rest of the home-v2 page
(other sections, footer) is not built.

## Behavior

A tall section pins a stage under the sticky nav. Scroll progress `p` (0 to 1) drives everything through
one pure function, `renderDashboardBuild(stage, p)` in
`src/components/marketing/dashboard-build/dashboard-build-timeline.ts`. Scrolling down assembles the
panels; scrolling up takes them apart. There is no separate reverse animation, so both directions render
the same state for the same `p`.

- Native scrolling only: no wheel or touch interception. Displayed progress eases toward the scroll
  target (`dampProgress`). Only `transform` and `opacity` are animated.
- `pinnedProgress` accounts for the 80px sticky nav (`NAV_PX`); the stage pins at `top: var(--db-nav)`.
- **First frame:** a faint dashed wireframe of the page-to-be (`ghostOpacity`, hands over by p = 0.14)
  and an animated "Scroll to build your dashboard" cue (`cueOpacity`, gone by p = 0.05, back when you
  scroll to the top). Both are visible in light and dark. Both are hidden in the unpinned fallbacks.
- **Camera:** the real page is much taller than a screen, so the stage is a clipped window and a camera
  pans down the page as it builds (`cameraFraction`), then glides back to the top
  (`CAMERA_RETURN_START`) so the held final frame is the hero and KPIs. Travel is measured from the
  real layout (`ResizeObserver`), never hard-coded.
- **New-order beat** (`BEATS`), told the way the product tells it, with no invented toast. The new order
  lands on a quiet table (Table 11, p about 0.86 to 0.89): the floor tile highlights and "Orders open" and
  the pulse's "open orders" go 6 to 7. The Dispatch "Awaiting acceptance" tile counts one more as the
  returning camera passes it (about 0.95), then the bell badge (and the phone Orders badge) count one more
  (about 0.985). Each reverses on scroll-up. Floor and pulse data change, so React re-renders them from
  `NewOrderContext` at the table beat; the other two beats are DOM-driven (`--beat`, `data-on`).
- **Captions and links:** the stage is a picture (`inert`, `aria-hidden`), so explanatory copy and links
  live beside it (`CHAPTER_CAPTIONS`, one per chapter, shown with the chapter rail). Every link must be an
  existing public page (a test checks it). Copy describes what the replica shows and what the product code
  does and makes no availability promises. Reduced-motion and no-JS users get every caption as a list.
  The page ends with a "See it for yourself" CTA to `/demo` and `/pricing`.

## Shared product code (so the replica cannot drift)

The first version hand-copied dashboard markup, so redesigns that landed on `main` later (the miniature
dining floor and Today's pulse) were missing. Now:

- **Floor and pulse are the product's own code.** `FloorGlanceView` (`components/dashboard/floor/`) and
  `TodayPulsePanel` (`components/dashboard/pulse/`) are pure views extracted from `TableFloorMatrix` and
  `TodayPulseBento`, which keep their router refresh, timers and state. The preview feeds the views sample
  data (`buildReplicaFloor`, `buildReplicaPulse`, a real `FloorOverview` for the demo outlet's 12 tables)
  and swaps in a non-navigating link (`LinkComponent`) and a scroll-driven number (`Figure`, `locale`).
- **The nav is shared.** `HomeNav` (`components/marketing/navigation/home-nav.tsx`) is the homepage's nav
  bar (logo, links, sign-in/CTA, the animated appearance toggle, phone menu), used by `/` and `/home-v2`.
- **Parity test.** `REPLICA_WIDGETS` must equal `dashboardWidgetIds`, in order
  (`tests/dashboard-build-timeline.test.ts`), so a widget added to or reordered in the product fails CI
  until the replica follows.
- The sidebar, top bar, hero, KPIs, priorities, health, Dispatch and requests are still replicated
  markup using the product's class names, nav model, icons, artwork and copy. When one of those is
  redesigned, prefer extracting a pure view the same way.

## Layout notes

The stage is a fixed virtual screen (1440 x 900 desktop, 390 x 700 phone) scaled to fit with CSS
`tan(atan2())`, so the real CSS renders at true pixel sizes. The product re-flows by _viewport_ width
(1320, 1280, 1160, 1150, 1100, 900, 850px across `workspace.css`, `workspace-delight.css`,
`dashboard-operations.css`, and the floor module's 560px). `dashboard-build.css` re-asserts the desktop
layout in those ranges, including the rule that makes the floor span two rows beside the stacked
requests and pulse widgets. If the product's responsive rules change, update that block. The pulse's
container queries follow the virtual screen on their own. Phones use the real bottom bar and mobile
hero; the mobile hero WebPs come from `scripts/dashboard-media.mjs` (run by `pnpm dev`/`build`,
gitignored).

## Fallbacks

- `prefers-reduced-motion: reduce`, or scripting disabled: no pin, no cue, no wireframe; the whole page
  is shown at its natural height (no window, no camera), scaled to the width with `zoom`, with every
  caption listed. Counters server-render their final values, so no-JS visitors never see zeros.
- `position: sticky` needs no ancestor with `overflow: hidden`; the stage uses `overflow: clip`.

## Marketing fixture

No API calls, auth or tenant data. Every number, time, table state and request is sample data shaped like
the public demo outlet (table names from `src/modules/demo/baseline.ts`, top sellers are real demo dishes
and prices) and must not be presented as a customer's data. Known deviations from the product: the top-bar
Help button and the feature-flagged Shift summary button are omitted; the till, bell and connection chips
are static samples.

## Verification (last run)

- `tests/dashboard-build-timeline.test.ts` (15 tests: timeline, beats, captions and links, demo floor and
  pulse consistency, widget parity). The repo's global vitest setup needs a migration database; the file
  is pure logic and was run with a DB-free config locally (CI runs it under the normal setup).
- `tests/e2e/home-v2-dashboard-build.spec.ts` (8 scenarios, desktop and Pixel 5): nav and appearance
  toggle, cue and wireframe, assemble/disassemble symmetry, the product's floor, pulse and widget order,
  the new-order beat, inert stage and captions, no overflow, reduced motion. Run locally against `next
dev` with a scratch config; the repo config needs the infrastructure server.
- The existing homepage specs (`brand-nav`, `home-layout`, `homepage-polish`) pass with the extracted nav.
- axe (WCAG 2 A/AA) on the nav, section and CTA: no violations in light, dark, phone and reduced motion.
- Full `next build` passes; `/home-v2` is prerendered static: about 49 KB CSS and 225 KB JS gzipped (the
  current homepage: about 44 KB and 265 KB).
