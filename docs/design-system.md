# Approved design direction: Ink & Ember

Status: approved direction; exact visual tokens and implementations require verification against
approved design artifacts. Do not invent a hex palette or typography scale and label it approved.

- Light mode: vivid accents on white surfaces; avoid washed-out overall presentation.
- Dark mode: ink surfaces with gold/orange/ember accents and readable text.
- Ember Flow: gradient buttons for routine actions with intent-driven feedback.
- Ink Press: stronger tactile feedback for selected deliberate actions.
- Feedback hierarchy: A for routine outcomes, B for milestones, C for optional guidance.
- Use shadcn/Radix accessible primitives, Lucide and coherent custom food SVG illustrations.

Use CSS for routine button states and selective lazy Motion for richer interactions. Respect reduced
motion, focus visibility, contrast and touch targets. Preserve focus/scroll in dialogs. Error feedback
must explain recovery without exposing diagnostics/secrets. Busy controls prevent accidental repeats,
but backend idempotency remains mandatory.

KDS emphasizes legibility, urgency, connectivity and acknowledged state; critical status must not rely
on color or animation alone. Do not show order accepted until authorized acceptance is persisted.

Review visual choices in PDF when requested, following the user's preference. Confirm precise tokens
from approved artifacts before the UI implementation; planning direction is not a complete token set.
