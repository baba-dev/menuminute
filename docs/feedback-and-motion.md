# Ink & Ember — Feedback, overlays and motion

Status: **popup hierarchy user-approved, 14 October 2026**.

The user approved the recommended hierarchy from the PDF review: **A routine / B milestones / C optional guidance**. This extends the approved Ink & Ember theme and Ember Flow / Ink Press buttons. The review artifact is **MenuMinute-Feedback-and-Motion-Review.pdf**.

The hierarchy is settled. Detailed animation timings and graphic frames below are implementation targets from the review pack; verify the rendered components and behavior during Phase A.

## 1. Approved hierarchy

| Treatment        | Use                                                   | Character                                                                                    | Limits                                                                                                 |
| ---------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A — Service Card | Routine dialogs, focused decisions and short forms    | Clean surface, compact header, restrained icon, concise consequence and natural action order | The default overlay; do not interrupt users for routine success or a single field error                |
| B — Ink Ticket   | First publication and occasional important milestones | Ticket rhythm, small offset ink edge, one food/ticket mark and tactile focal action          | Sparse; not every save, completed order or success toast                                               |
| C — Chef's Note  | Optional onboarding tips and contextual guidance      | Short chef's annotation and one selective marker gesture                                     | Dismissible guidance only; never required choices, prices, errors, permissions or service instructions |

A, B and C are roles in one shared system, not unrelated component libraries. They inherit the same light/dark tokens, typography, state semantics, focus management and responsive behavior.

## 2. Placement by task

| Situation                                    | Presentation                                                                              |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Publish saved menu changes                   | A decision dialog, with Ink Press as the focal publish action                             |
| First successful publication                 | B milestone, after publication is confirmed                                               |
| Optional menu-setup hint                     | C contextual guidance                                                                     |
| Dish-field validation or failed image upload | Inline feedback beside the affected field/task                                            |
| Routine save or cart addition                | In-place state/count change; compact toast only if useful                                 |
| Kitchen disconnection or stale data          | Persistent connection banner with last successful sync                                    |
| Unknown order-submission outcome             | Persistent checking/recovery state; resolve the original idempotent submission            |
| Cancel accepted work                         | Clear A confirmation with consequence, role check and reason; semantic destructive action |
| Long or recoverable background work          | Non-blocking progress/status surface with a useful return path                            |

Avoid stacking dialogs. If a new decision follows a dialog, transition the existing flow or close it before opening another. Keep the user's entered values and place in the workflow.

## 3. Dialog and mobile behavior

Service Card is the normal dialog shell. Use one clear title, concise consequence, close/cancel path and at most one focal primary action. Reserve inline space for pending/error feedback rather than replacing the dialog with unrelated screens.

Use a mobile bottom sheet for cart configuration and routine options. Keep focused destructive decisions explicit. Ensure the action footer clears the keyboard and device safe area; long content can scroll without hiding the title or required controls.

Move focus into an opened dialog and return it to the invoking control on close. Keyboard navigation remains contained in a modal. Escape, backdrop and mobile-back behavior must preserve drafts where appropriate and never implicitly confirm a destructive action. Use a visible close/cancel path for dismissible dialogs.

An active request may prevent duplicate action without trapping the entire interface indefinitely. On failure, preserve context and give a safe next step. Success appears only after the authoritative operation commits.

## 4. Alerts and error language

| State   | Meaning                                  | Pattern                                        |
| ------- | ---------------------------------------- | ---------------------------------------------- |
| Info    | Explain a condition or available step    | Blue semantic accent + info icon + plain title |
| Success | Confirm a committed outcome              | Green accent + check + explicit result         |
| Warning | Attention or impaired service            | Amber accent + warning icon + next step        |
| Error   | An operation failed or input must change | Red accent + error mark + recovery instruction |

Brand gold/orange is not itself a warning or success state. Pair status color with words and icons. Use the reviewed light/dark surface pairs; gradients remain action emphasis, not paragraph backgrounds.

Useful feedback states describe:

1. What happened.
2. What is preserved or still uncertain.
3. What the user can safely do next.

Examples:

- **Publishing failed** — Your saved draft is safe. The public menu still shows the previous version. Retry publishing.
- **Image could not be uploaded** — The file was not saved. Your other menu changes are safe. Choose another image.
- **Checking your order** — We have not confirmed the result yet. Keep this page open while we check.
- **Kitchen is reconnecting** — Existing tickets remain visible; new updates may be delayed. Last synced time remains visible.
- **This dish just sold out** — Preserve the other cart items and offer Review cart.

Do not offer a fresh order submission while its previous result is unknown. Recover using the original idempotency key/status. Do not show a refund, payment or stock guarantee merely because fulfillment changed.

Form errors retain entered values, visible labels and specific guidance. On failed submit, provide a summary linked to invalid fields and an appropriate focus target. Do not show errors on the first keystroke or rely on red outlines alone.

## 5. Toasts and snackbars

Use compact, non-modal feedback. A cart count or saved state remains visible in context even after a toast disappears. Routine success can dismiss after about 4–5 seconds; pause dismissal while hovered/focused and make any action keyboard-accessible.

Keep a single quiet stack with no more than three visible messages. On mobile, position above the cart/safe area. Do not steal focus. Essential failures, connection warnings and ambiguous order results must remain in persistent task UI; a transient toast cannot be their only presentation.

Undo appears only when the operation has a real, supported reversal. A failed upload should preserve the existing image rather than displaying a success-like placeholder.

## 6. Buttons and intent-driven state changes

Use the [approved button contract](button-options.md):

- **Ember Flow**: everyday cart, save, continue and routine service actions.
- **Ink Press**: selected focal or milestone actions needing tactile emphasis.
- **Quiet secondary**: preview, back and cancel.
- **Semantic destructive**: explicitly destructive operations, not the default bright brand gradient.

Pending actions prevent duplicate activation. Display meaningful pending text and an indeterminate indicator unless real measured progress is available. Preserve a stable label area and touch target. Confirm success after server acknowledgment; retain a useful outcome rather than copying the comparison's short automatic reset.

Errors preserve context and offer a safe retry. A success check, ticket draw or milestone flourish must never play for a failed or unresolved operation.

## 7. Motion language

Motion shows cause and preserves place. No perpetual idle shimmer, pulsing call to action, decorative page-wide movement or automatic sound.

| Interaction                  | Proposed target                        | Behavior                                                        |
| ---------------------------- | -------------------------------------- | --------------------------------------------------------------- |
| Press settle                 | 80–160ms                               | Small tactile displacement/compression                          |
| Dialog entry                 | 160–200ms                              | Opacity plus about 4px rise                                     |
| Mobile sheet                 | 200–240ms                              | Short vertical entrance; preserve action placement              |
| Toast entry                  | 140–180ms                              | Opacity plus about 6px rise                                     |
| Confirmation check           | 120–220ms                              | One clear settle after committed success                        |
| Food/ticket graphic sequence | About 320ms for the illustrated reveal | One readable transition; exact art/timing verified in prototype |

These durations are not request latency, progress estimates or artificial minimum waits. Do not delay an operation to complete an animation. Keep order/ticket rows stable while staff interact; move a ticket only after confirmed state change.

### Motion-graphic concepts from the review

- **Steam Line**: subtle steam rise/settle while work is pending. Keep the status text visible. Stop when the operation completes, fails or the surface is no longer visible.
- **Ticket Draw**: short receipt/check reveal after a committed success, suitable for B milestones.
- **Ember Spark**: optional rare first-publication flourish from the review concept; not a routine default or a reason to add confetti/audio.

Use original food/service motifs rather than importing Creators' cursor or studio identity. Keep illustration neutral around error/security/payment content. In reduced-motion mode, use static marks and the same labels without losing any information.

## 8. Loading, empty and offline states

Reserve media dimensions and use stable skeletons when a wait actually needs them. Do not fabricate dish data or display invented percentage progress. Avoid loader flashes on fast actions.

An empty menu can show one small plate outline, a clear first-step message and Add a dish. Offline/stale views distinguish cached content from live state. PWA installation does not imply offline order acceptance or automatic submission replay.

## 9. Implementation acceptance

Verify A/B/C, alerts, toasts, forms, pending/error/success, loading/empty/offline states and all shared overlays in **Light / Dark / System**. Check:

- Keyboard focus, close/cancel/back behavior and draft preservation.
- 44px or larger effective touch targets and safe-area/keyboard spacing.
- Long labels, Hindi support where enabled, 200% zoom and 360–1440px layouts.
- Required text and control-boundary contrast, including every gradient state.
- Reduced motion and announced results that do not repeat every animation frame.
- Duplicate activation, ambiguous submission, concurrent kitchen actions, reconnect recovery and retry behavior.

This document records the design contract. It does not claim that the current starter application implements these components or passes the behavior checks.
