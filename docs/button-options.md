# Ink & Ember — Approved gradient buttons

Status: **user-approved hybrid, 14 October 2026**. Use **Ember Flow for everyday actions** and **Ink Press for a stronger tactile feel**. Hearth Glow and Service Split are archived alternatives; the earlier flat brochure buttons remain excluded.

## Usage hierarchy

| Treatment            | Role                                             | Examples                                                                     |
| -------------------- | ------------------------------------------------ | ---------------------------------------------------------------------------- |
| Ember Flow           | Default everyday primary action                  | Add to cart, save changes, continue, apply settings, routine service updates |
| Ink Press            | Deliberate focal action needing tactile emphasis | Publish menu, prominent first-menu CTA, a selected milestone action          |
| Quiet secondary      | Supporting action in the same group              | Preview, cancel, back                                                        |
| Semantic destructive | An explicitly destructive action                 | Delete, revoke, cancel accepted work with permission/reason                  |

Ink Press is a semantic variant in the same button system, not an unrelated style. Use it sparingly, normally at most one focal action per group or major viewport. A kitchen board favors large, fast Ember Flow actions; do not add a decorative stamp/shadow to every ticket. Do not equate tactile emphasis with destructive confirmation.

## Approved geometry

- **Ember Flow**: 13px corners, warm gradient face, trailing icon tile, subtle elevation.
- **Ink Press**: 9px corners, ink outline, small offset shadow, leading icon divider and the same gradient family.
- Preserve at least 44px touch targets; favor 48–56px in service contexts.
- On coarse pointers, do not depend on hover to expose an action.
- Secondary and destructive actions retain clear semantic treatments rather than inheriting the bright primary gradient automatically.

## Exploration archive

## Four candidates

| Family        | Geometry and gradient                                                        | Hover/press character                                               | Confirmation                                        |
| ------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | --------------------------------------------------- |
| Ember Flow    | 13px soft rectangle; ember → amber → gold; trailing icon tile                | Slight directional gradient shift; 1px hover lift and tactile press | Icon becomes a check; success label replaces action |
| Ink Press     | 9px corner, ink outline, offset shadow; warm gradient face with leading icon | Lift exposes ink edge; press settles the button into its shadow     | Restrained check stamp                              |
| Hearth Glow   | Capsule, inset icon circle; curved warm gradient                             | Halo appears on hover; slight compression on press                  | Halo settles; check and explicit result             |
| Service Split | Crisp 7px rectangle; gradient face plus separate trailing icon compartment   | Icon compartment expands slightly; forward action motion            | Segment resolves to a check                         |

The interactive comparison demonstrates guest Add to cart, owner Publish menu and kitchen Mark ready in light and dark mode. It is response content, not a live application or a production integration.

## Gradient contract

Use the selected Ink & Ember vivid-orange/white and gold-orange/charcoal language. Approved base gradient stops are:

- Light: `#FF5B1A` → `#FF8A1E` → `#FFD046`.
- Dark: `#FFD54B` → `#FFB52C` → `#FF7A1A`.
- Foreground: near-black `#211600`. Sampled sRGB interpolation checks gave minimum text contrast of 5.73:1 in light mode and 6.83:1 in dark mode; recheck rendered states during implementation.

Do not assume white labels are readable on bright orange/gold. Gradients are emphasis, not a replacement for status semantics. Quiet secondary/destructive actions require their own accessible treatment; do not turn every operation into the same bright primary.

## Motion follows intent

- **Add to cart**: a brief forward cart/bag motion after activation; confirm the committed cart count. Prevent duplicate submission.
- **Publish menu**: pending state while the request is outstanding; lock duplicate activation. Use real progress only if measured. Otherwise use an indeterminate indicator and text, never a fabricated percentage. Show publication success only after server acknowledgment.
- **Mark ready**: directional service cue; update to a clear check/Ready state only when the server commits the order transition. Reconcile conflicts.
- **Error**: preserve/recover context, show an explicit error and a safe retry action. A success flourish must never play for a failed or ambiguous request.
- **Hover/focus**: small orientation cues, no endless sheen, looping shimmer or ambient pulsing on idle controls.
- **Reduced motion**: remove nonessential movement, keep labels/icons and immediate state feedback. Do not depend on animation to show a change.

The interactive comparison uses explicitly simulated delays and a finite demo progress sweep; these are not production progress estimates. No real publishing or orders occur.

## Implementation acceptance

The hybrid is selected. Validate all gradient points and every state in both modes, keyboard/touch interaction, 44px or larger targets, long labels/localization, duplicate prevention, errors and reduced motion. Production feedback remains visible until the user has a meaningful next action; the short automatic reset in the comparison is demonstration-only.
