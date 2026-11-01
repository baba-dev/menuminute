# home-v2 — scroll-assembled dashboard

Status: **scroll mechanics plus real sidebar, top bar and KPI row implemented** at `/home-v2`
(`noindex`, not in the sitemap). The hero, priorities, outlet health, service pulse, floor map and
new-order panels are still labelled placeholders; their real versions are planned, not built.

## Real components (this slice)

`dashboard-replica.tsx` renders static, inert replicas of the sidebar, top bar and "At a glance" KPI
row using the product's own class names (`workspace.css`, `workspace-delight.css`), nav model
(`src/modules/dashboard/nav-model.ts`) and icons, so they track the product. Labels and KPI detail
strings are the real dashboard's. Values come from `dashboard-build-fixture.ts` (sample data modelled
on the public demo outlet; never a customer's numbers).

The stage is a fixed virtual screen (1440×960 desktop, 390×800 phone) scaled to fit with CSS
`tan(atan2())`, so the real CSS renders at true pixel sizes. Phones use the real bottom bar instead of
the sidebar. Known deviations: the top-bar Help button is omitted for room, and the till, bell and
connection chips are static samples.

Cost: the route now loads `workspace.css` and `workspace-delight.css` (both class-scoped, no global
selectors). Extract a shared stylesheet if bundle size matters.

## Behavior

A tall section pins a stage. Scroll progress `p` (0–1) drives everything through one pure function,
`renderDashboardBuild(stage, p)` in `src/components/marketing/dashboard-build/dashboard-build-timeline.ts`.
Scrolling down assembles the panels; scrolling up takes them apart. There is no separate reverse
animation, so both directions render the same state for the same `p`.

- Native scrolling only: no wheel or touch interception.
- Displayed progress eases toward the scroll target (`dampProgress`) so flicks stay fluid.
- `p` ≥ 0.9 holds the finished dashboard. The stage is `aria-hidden` and has no focusable content yet; hotspots (gated by `INTERACTIVE_AT`) arrive with the feature-link slice.
- Only `transform` and `opacity` are animated.
- Phone (≤ 680px) uses a separate compact layout and a shorter scroll length (300vh vs 400vh).

## Fallbacks

- `prefers-reduced-motion: reduce`: no pin, finished dashboard, chapter rail hidden.
- Scripting disabled: no pin, finished dashboard (the server renders the exploded pose, CSS overrides it).
- `position: sticky` needs no ancestor with `overflow: hidden`; the stage uses `overflow: clip`.

## Marketing fixture

No API calls, auth or tenant data. Counter values are placeholders (the demo catalogue has 236 dishes)
and must not be presented as a customer's data.

## Verification

`tests/dashboard-build-timeline.test.ts` covers ranges, assembled/exploded endpoints, direction
symmetry, count-up reversal, scroll geometry and damping. The repo's global vitest setup requires a
migration database; the file is pure logic and was run with a DB-free config locally.
