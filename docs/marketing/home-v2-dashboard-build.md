# home-v2 — scroll-assembled dashboard

Status: **mechanics implemented with placeholder panels** at `/home-v2` (`noindex`, not in the sitemap).
The real dashboard styling, sample data and copy are planned, not built.

## Behavior

A tall section pins a stage. Scroll progress `p` (0–1) drives everything through one pure function,
`renderDashboardBuild(stage, p)` in `src/components/marketing/dashboard-build/dashboard-build-timeline.ts`.
Scrolling down assembles the panels; scrolling up takes them apart. There is no separate reverse
animation, so both directions render the same state for the same `p`.

- Native scrolling only: no wheel or touch interception.
- Displayed progress eases toward the scroll target (`dampProgress`) so flicks stay fluid.
- `p` ≥ 0.9 holds the finished dashboard; panels are `inert` (not focusable or clickable) until `p` ≥ 0.95.
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
