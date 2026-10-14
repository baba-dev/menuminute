# Ink & Ember — Gradient button review

Status: **base theme approved; button family unselected**. The user selected Ink & Ember but explicitly excluded the earlier flat buttons. They want gradient fills and intent-driven animation.

## Four candidates

| Family        | Geometry and gradient                                                        | Hover/press character                                               | Confirmation                                        |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Ember Flow    | 13px soft rectangle; ember → amber → gold; trailing icon tile                | Slight directional gradient shift; 1px hover lift and tactile press | Icon becomes a check; success label replaces action |
| Ink Press     | 9px corner, ink outline, offset shadow; warm gradient face with leading icon | Lift exposes ink edge; press settles the button into its shadow     | Restrained check stamp                              |
| Hearth Glow   | Capsule, inset icon circle; curved warm gradient                             | Halo appears on hover; slight compression on press                  | Halo settles; check and explicit result             |
| Service Split | Crisp 7px rectangle; gradient face plus separate trailing icon compartment   | Icon compartment expands slightly; forward action motion            | Segment resolves to a check                         |

The interactive comparison demonstrates guest Add to cart, owner Publish menu and kitchen Mark ready in light and dark mode. It is response content, not a live application or a production integration.

## Gradient contract

Use the selected Ink & Ember vivid-orange/white and gold-orange/charcoal language. Candidate preview stops are:

- Light: `#FF5B1A` → `#FF8A1E` → `#FFD046`.
- Dark: `#FFD54B` → `#FFB52C` → `#FF7A1A`.
- Foreground: near-black `#211600`, verified across all stops and interpolation before implementation.

Do not assume white labels are readable on bright orange/gold. Gradients are emphasis, not a replacement for status semantics. Quiet secondary/destructive actions require their own accessible treatment; do not turn every operation into the same bright primary.

## Motion follows intent

- **Add to cart**: a brief forward cart/bag motion after activation; confirm the committed cart count. Prevent duplicate submission.
- **Publish menu**: pending state while the request is outstanding; lock duplicate activation. Use real progress only if measured. Otherwise use an indeterminate indicator and text, never a fabricated percentage. Show publication success only after server acknowledgment.
- **Mark ready**: directional service cue; update to a clear check/Ready state only when the server commits the order transition. Reconcile conflicts.
- **Error**: preserve/recover context, show an explicit error and a safe retry action. A success flourish must never play for a failed or ambiguous request.
- **Hover/focus**: small orientation cues, no endless sheen, looping shimmer or ambient pulsing on idle controls.
- **Reduced motion**: remove nonessential movement, keep labels/icons and immediate state feedback. Do not depend on animation to show a change.

The interactive comparison uses explicitly simulated delays and a finite demo progress sweep; these are not production progress estimates. No real publishing or orders occur.

## Before implementation

Let the user choose the button family or hybrid. Then validate all gradient points and every state in both modes, keyboard/touch interaction, 44px or larger targets, long labels/localization, duplicate prevention, errors and reduced motion. Production feedback remains visible until the user has a meaningful next action; the short automatic reset in the comparison is demonstration-only.
