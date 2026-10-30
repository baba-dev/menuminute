# Dashboard delight and polish — implementation plan

Status: **implemented in one PR; plan and as-built notes below.** Scope is the signed-in merchant workspace (`src/app/(dashboard)`), built on the approved [Ink & Ember design system](design-system.md) and the [feedback and motion contract](feedback-and-motion.md). Nothing here changes authorization, order, payment or kitchen state machines.

## Goals

1. Milestone moments (Ink Ticket) and contextual guidance (Chef's Note) that respect "one focal gesture per viewport".
2. Skeleton loaders that match the real card layouts.
3. Optimistic updates with a rollback toast, only where the feedback contract allows them.
4. Per-user overview layout: reorder, hide and pin widgets, stored with the account preference.
5. An Ember "Shift summary" draft that a manager reviews before using.
6. Accessibility: skip link, landmark and keyboard coverage, status never conveyed by colour alone.

## Decisions that differ from the original wording

| Original idea                   | Decision                                                                                                                                        | Reason                                                                                                                                                                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "First £1k day" milestone       | Ship **first completed order of the day** and **order-count milestones (25 / 50 / 100 completed orders)** now. Revenue milestones are deferred. | Outlets use any supported local currency; a fixed £1,000 is meaningless for INR or JPY. The overview pulse has no revenue figure, and adding one needs a per-outlet goal setting.                                                 |
| Optimistic updates "everywhere" | Optimistic **only** for (a) layout changes and (b) the dish availability toggle. Never for orders, kitchen or POS.                              | The feedback contract says success appears only after the authoritative operation commits and ticket rows stay stable until confirmed. The availability toggle shows a pending state, not success, until the server acknowledges. |
| Shimmering skeletons            | Static placeholders, no looping shimmer.                                                                                                        | The motion contract forbids perpetual idle shimmer; reserve dimensions only.                                                                                                                                                      |
| Drag-and-drop reorder           | Move up / move down buttons, no new dependency.                                                                                                 | Keyboard- and screen-reader-operable by construction; `AGENTS.md` requires reviewed dependencies.                                                                                                                                 |

## 1. Milestones (Ink Ticket) and Chef's Note

- New client component `MilestoneTicket` (treatment B). One at a time; queued if several fire. Dismissible, focus-safe (non-modal, `role="status"`, never steals focus).
- Trigger source is the existing `/api/dashboard/pulse` snapshot already polled by `DashboardServicePulse`. A milestone fires only when `state === "ready"` and the **authoritative** `completedToday` crosses a threshold between two successive successful reads in this tab. A page load that starts above a threshold does not replay it.
- Once-per-day memory is a per-viewer convenience in `localStorage`, keyed `outletId + outlet-local date + milestone id`, wrapped in try/catch. If storage is unavailable the ticket still shows at most once per page session.
- Never fired for failed, restricted or unavailable pulse states. No sound, no confetti. Reduced motion renders the static ticket with identical copy.
- "One focal gesture": while a ticket is open the overview root carries `data-milestone-open="true"` and the existing Chef's Note in "Today's priorities" is hidden.
- Chef's Note (treatment C): the existing note is kept; no new note was added. Milestones are only observed while the Service Dispatch widget is visible, because that widget owns the pulse polling. Hiding it disables milestones for that user.

## 2. Skeletons

- Shared `Skeleton` primitives (block, line, card) with reserved dimensions and `aria-hidden`; one `role="status"` announcement per route.
- Add layout-matched `loading.tsx` for `dashboard/pos`, `dashboard/reports`, `dashboard/organization`; rebuild `dashboard/loading.tsx` to mirror hero, KPI grid, priorities, dispatch, health.
- Per-widget Suspense fallbacks use the same primitives so a slow widget does not shift layout.
- Avoid loader flash: fallbacks render only after a short CSS-delay (`animation-delay`, no looping animation) so fast loads show nothing.

## 3. Optimistic updates with rollback toast

- Generic `useOptimisticCommit` hook: apply local change, mark item `pending`, send the request, on non-2xx or network error roll back to the captured snapshot and raise a `sonner` toast with a **Retry** action (keyboard-focusable, not focus-stealing; persistent failures also stay inline).
- Applied to the layout editor and to `DishAvailabilityDialog`. The dialog keeps its existing GET-compare-then-write revision handshake and idempotency key; a conflict rolls back and asks the user to refresh instead of overwriting.
- A pending row shows an icon and the word "Saving", never a success check. While pending, the control's accessible name is "Saving <dish>", not "Restore" or "Mark sold out", so it never claims the final state. (An existing browser test caught the first implementation, which flipped the label early.) Success appears only after the server acknowledges.
- Layout saves are debounced (400 ms), coalesced, and flushed immediately on Done, on Escape, and on `pagehide` with `keepalive` so a quick change followed by navigation is not lost.
- Toast stack respects the contract: at most three visible, pause on hover/focus, no focus theft.

## 4. Per-user layout (reorder, hide, pin)

- Widgets are identified by a closed enum: `kpis`, `priorities`, `dispatch`, `health`, `floor`, `serviceRequests`. The hero stays fixed.
- **Persistence:** additive migration `0054_dashboard_layout_preference.sql` adds a nullable `dashboard_layout jsonb` column (with a length/shape CHECK) to `account_workspace_preferences`. The table already has FORCE row-level security keyed on `app.actor_id` and table-level grants, so no policy or grant change is needed. Expand-only: older app builds ignore the column. Layout is a presentation hint, never an authorization input.
- **Validation:** strict zod schema `{ version: 1, order: WidgetId[], hidden: WidgetId[], pinned: WidgetId[] }`, unique ids, max 12 entries, unknown ids dropped on read, new widgets appended on read, and a permission-gated widget the user cannot access is skipped regardless of the stored layout.
- **API:** `GET/PUT /api/account/dashboard-layout`, `requestActor(req, true)` (same CSRF/origin handling as `/api/context`), `private, no-store`, bounded JSON body, `PUT` is a full replace with `updatedAt` last-write-wins. `DELETE` resets to default.
- **Read path:** the overview page reads the layout server-side to avoid a flash and **skips data fetching for hidden widgets** (for example, the floor matrix query).
- **UI:** "Customize" toggle in the overview header opens an edit mode with Move up, Move down, Hide/Show and Pin/Unpin per widget, plus Reset. Pinned widgets render first in pinned order, then the rest. All changes are optimistic with rollback. Announces changes through a polite live region ("Dispatch moved to position 2 of 5").

## 5. Shift summary (Ember)

- Button in the overview header, rendered only when `AI_ASSISTANT_READ_ONLY_ENABLED` is true and the user has an outlet; otherwise absent, not disabled.
- Reuses the existing conversation and read-only turn pipeline so budget reservation, two-attempt limit, scope re-checks, audit and evidence capture are inherited. No new provider call path, no tools beyond the existing read tools, no model-generated SQL.
- The prompt is a constant in `src/modules/dashboard/shift-summary.ts`, but the existing turn endpoint accepts any prompt from the signed-in user, so the prompt is **not** an authorization boundary. The draft is advisory and never leaves the dialog unless the manager copies or downloads it. Retries reuse the same conversation and turn idempotency keys so a replay returns the stored turn.
- Result opens in a Service Card (treatment A) dialog titled "Shift summary — draft": editable textarea, an evidence list (the tool results the answer was built from, with captured-at times), **Copy** and **Download .txt**. Nothing is stored, emailed or published automatically.
- Guardrails: banner "Draft. Check the figures before sharing"; no dietary or allergen claims; if the turn fails, shows the standard error with retry and the dialog never shows a partial answer as final. A post-check flags numbers in the draft that do not appear in the evidence and shows a warning with the affected figures.

## 6. Accessibility

- **Skip link** as the first focusable element in the workspace shell: "Skip to main content" → `#workspace-main` (`tabIndex={-1}`), visible on focus, 44px target.
- **Landmarks:** label the sidebar (`aria-label`), keep one `main`, one `h1` per route; move focus to the route `h1` after client navigation.
- **Status not by colour alone:** audit and fix health badges, pulse counters, nav `is-unavailable` label, floor matrix status, order age states. Each gets an icon plus text.
- **Live regions:** pulse changes announced politely and only on a meaningful change, not every poll.
- **Keyboard:** visible `:focus-visible` ring on every shell control, no keyboard traps, Escape closes the layout editor and dialogs and returns focus to the trigger.
- **Targets and zoom:** 44px minimum targets, usable at 200% zoom and 320px width, `prefers-reduced-motion` honoured for all new motion.
- Light, dark and system themes verified for every new component using existing tokens only.

## As built: differences from the plan

- Hidden widgets skip their data loading for the floor matrix; the others are cheap shared computations the hero and priorities already need.
- The widget wrapper grid is a 12-column grid. The default order reproduces the previous overview (full-width glance and health, two half-width pairs).
- DOM order follows the layout on the server, so tab order and reading order match what sighted users see. CSS `order` is used only to make optimistic edits instant before the server re-renders.
- The pulse's freshness line no longer carries `role="status"`; a separate polite region announces only when the awaiting-acceptance count rises.
- Revenue milestones remain deferred (see decisions above).
- Ember selects tools by keyword (`tool-selection.ts`, from Ember Intelligence 2.0). The shift-summary prompt is worded so only the orders, kitchen and dining-table tools are shortlisted: no sales words (these pull in the reports tool), no "draft" or "menu", no "food" or "dish", and no merchant-chosen text. `tests/dashboard-shift-summary.test.ts` runs the prompt through the real router so a future wording change that pulls in other tools fails the test.
- The Ember-enabled CI lane now also runs `tests/e2e/shift-summary.spec.ts` (one-line change to `.github/workflows/ci.yml`). The model is stubbed at the two assistant endpoints there; the spec verifies the page behaviour, not model output.

## Files (expected)

| Area          | Paths                                                                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Shell         | `src/app/(dashboard)/layout.tsx`, `workspace.css`, `workspace-navigation.tsx`                                                                                                         |
| Overview      | `src/app/(dashboard)/dashboard/page.tsx`, `dashboard-service-pulse.tsx`, `dish-availability-dialog.tsx`, `loading.tsx`, new `dashboard-layout-editor.tsx`, `shift-summary-dialog.tsx` |
| Components    | new `src/components/ui/skeleton.tsx`, `src/components/dashboard/milestone-ticket.tsx`, `src/lib/use-optimistic-commit.ts`                                                             |
| Layout module | new `src/modules/dashboard/layout-preference.ts` (schema, read, write), `src/app/api/account/dashboard-layout/route.ts`                                                               |
| Data          | `src/db/schema/continuity.ts`, `src/db/migrations/0054_dashboard_layout_preference.sql`, `meta/_journal.json`                                                                         |
| Loading       | `dashboard/{pos,reports,organization}/loading.tsx`                                                                                                                                    |
| Tests         | `tests/dashboard-layout-preference.test.ts`, `tests/dashboard-milestones.test.ts`, `tests/dashboard-a11y.test.tsx`, `tests/e2e/dashboard-delight.spec.ts`                             |

## Test plan

- **Unit:** layout schema (duplicates, unknown ids, oversize, defaults, new-widget append); milestone crossing logic (no replay on load, no fire on unavailable state, once per day); optimistic hook (apply, rollback, retry, double submit); summary number check.
- **Component (jsdom):** skip link focus target; layout editor keyboard operation and live-region text; status badges expose icon plus text; ticket is non-modal and respects reduced motion.
- **Integration (real PostgreSQL, CI lane):** migration applies on top of 0053, RLS lets a user read and write only their own layout, an older row without the column reads as default.
- **E2E (Playwright):** tab to skip link and activate it; hide a widget, reload, it stays hidden and its data is not fetched; availability toggle failure rolls back with a retry toast; light and dark; 320, 390, 768, 1440 px.
- Gates per `AGENTS.md`: `pnpm format:check`, `lint`, `typecheck`, `test`, `build`, and exact-SHA CI on all native ARM64 lanes.

## Risks and mitigations

| Risk                                       | Mitigation                                                                                                                                 |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| New migration auto-applies on merge        | Expand-only nullable column, verified in the real-PostgreSQL lane before merge; reviewed against `docs/automatic-migration-deployment.md`. |
| Hidden widget skips data a user expects    | Hiding is reversible and visible in edit mode; defaults restore everything.                                                                |
| Ember draft contains an unsupported figure | Fixed prompt, evidence list, number cross-check, review-required banner, no auto-send.                                                     |
| Milestone feels noisy                      | Once per milestone per outlet per day, one visible at a time, suppresses other focal gestures.                                             |
| Scope size                                 | Each section is independently testable; the PR description lists them as separate review areas.                                            |

## Rollback

Revert the PR. The nullable `dashboard_layout` column is harmless to older builds and needs no data migration. Stored layouts are preferences, not business state.
