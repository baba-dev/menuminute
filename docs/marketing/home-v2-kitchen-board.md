# home-v2: "Fired, plated, served" (section 3)

Status: **built and previewed** at `/home-v2` (`noindex`, not in the sitemap), after
[scan to order](home-v2-scan-to-order.md). It is a marketing preview with sample tickets: no order is placed
on this page. Kitchen Pro itself is built; the copy follows `/pricing` and ADR 025, which say real outlets
activate it after approval (pilot or paid path), so the section does not promise instant or universal
availability.

## Story

Sections 1 and 2 follow an order to the dashboard. Section 3 shows the kitchen making it: the Table 11
ticket (the same order as section 2) lands on a three-column board next to two ambient tickets, and a
guest view tracks it from "Request sent" to "Served".

## What is on the page

| Piece           | Behaviour                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------ |
| Board           | New, Preparing, Ready columns with a border beam; tickets glide between columns (FLIP)           |
| Ticket          | Age in sample minutes (rolling digits) with a tone **and a word**: On time, Due soon, Late       |
| Preparing rules | Each dish is a toggle with its station; a ticket cannot be marked ready until every dish is done |
| Actions         | Accept, Mark ready, Serve (real buttons; no drag, so it works by keyboard and touch)             |
| Guest view      | Five-step tracker whose progress line fills as the Table 11 ticket moves; confetti on Served     |
| Watch it run    | Autoplay walks Table 11 through all five steps; Reset restores the seed                          |
| Totals          | On the pass, Ready to serve, Served, as rolling numbers                                          |
| Cards           | Three spotlight cards linking to `/pricing`, `/demo`, `/help/owner`                              |

The sample clock runs one sample minute per real second, only while the board is on screen and the tab
is visible, and the page says so. All logic (stages, rules, age tones, autoplay step, tracker mapping,
confetti geometry) is pure and unit-tested in `kitchen-board-logic.ts`. Confetti positions are
deterministic (no `Math.random`).

## Shared pieces

`RollingNumber` moved to `src/components/marketing/rolling-number/` and is used by sections 2 and 3. Its
CSS is self-contained (`mm-roll` classes), so a section does not depend on another section's stylesheet.

## Rules this section keeps

- **Sample data only**, no API, payment, paid AI or order submission. State is local to the component.
- **No unqualified availability claim.** The note says Kitchen Pro is activated per outlet after approval
  and that visible areas depend on the plan; the guest view is labelled illustrative. Station labels derive from each sample dish's category.
- **Colour is never the only signal.** Ticket tone always has a word.
- **No invented social proof.** There are no testimonials, reviews or customer counts here.

## Accessibility and fallbacks

- Real, keyboard-operable buttons with specific labels ("Accept Table 11 ticket"); dish toggles use
  `aria-pressed`; a polite live region announces moves; the tracker marks done/current for assistive tech.
- `prefers-reduced-motion: reduce`: no animation or transition (no beam, shimmer, FLIP, confetti or roll),
  every control still works.
- Without script nothing is hidden (script only adds the first-view reveal); the interactions need script.

## Files

- `src/components/marketing/kitchen-board/` (`kitchen-board.tsx`, `-logic.ts`, `-fixture.ts`, `.css`)
- `src/components/marketing/rolling-number/` (shared)
- Mounted in `src/app/home-v2/page.tsx`; `.kb-container` joins the shared grid in `src/app/home-layout.css`.

## Verification (last run)

- `tests/kitchen-board.test.ts`: 11 tests (rules, autoplay, tones, tracker, summary, confetti, links, copy),
  run with a DB-free vitest config because the global setup needs a migration database.
- `tests/e2e/home-v2-kitchen-board.spec.ts`: 6 scenarios on desktop and Pixel 5 (12 runs): full stage
  walk with guest view, autoplay and reset, age words, no unqualified availability claim and links, no overflow and
  axe WCAG 2 A/AA, reduced motion.
- Section 2 (12 runs) and section 1 (16 runs) specs still pass after the `RollingNumber` extraction.
- `tsc --noEmit`, eslint and prettier clean for the changed files. The full `next build` needs real
  production configuration and was not run here; CI covers it.
