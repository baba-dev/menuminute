# MenuMinute — Shared design and theme contract

Status: **Ink & Ember selected; button design pending.** The user approved 01 Ink & Ember on 14 October 2026, explicitly excluding the brochure's flat buttons. Use gradient buttons with intent-driven animation; review [button options](button-options.md) before locking the button family.

The earlier five muted candidates remain rejected; Collection 02 alternatives are historical exploration, not active competing base directions. Keep the approved Ink & Ember typography and food-specific sketch character.

## Confirmed visual direction constraints

- Light: pure white canvas/working surfaces, near-black ink, vivid saturated controls and graphic accents. Do not replace these with tinted linen, sage or pastel washes.
- Dark: charcoal surfaces, gold primary emphasis and orange editorial/detail accents, with high-contrast readable text.
- Character: expressive headings, selective marker underlines, offset ink frames and small handwritten chef's notes, inspired by Creators' Pencil & Pixel.
- Food identity: steam, plate outlines, ingredients and ticket details replace studio/cursor imagery. Ink & Ember's Bricolage/DM Sans/Kalam roles and base palette are selected; final gradient button tokens and states remain under review.
- Keep ordinary controls, prices, financial/security content and kitchen instructions precise. Handwriting is a decorative annotation role only.
- Use at most one focal sketch gesture per main viewport and avoid stacking decoration on every card. Brand character should never obscure food or service state.

## Remaining button selection and implementation

1. User selects Ember Flow, Ink Press, Hearth Glow, Service Split, or a specified hybrid.
2. Refine gradient stops, label contrast, geometry and action-driven motion within Ink & Ember.
3. Prototype guest, owner and kitchen actions in both modes, including keyboard, touch, reduced motion, pending, error and success states.
4. Apply the accepted system throughout the app. Do not implement the explicitly rejected flat buttons.

The base theme is selected. No button candidate is implemented automatically.

## App-wide Light / Dark / System support

This is a confirmed user requirement, independent of which design wins.

| Surface                                           | Required theme coverage                                              |
| ------------------------------------------------- | -------------------------------------------------------------------- |
| Public marketing, pricing and demo                | Complete light and dark designs                                      |
| Sign-in, registration and onboarding              | Forms, errors, loading and confirmation states                       |
| Guest menu, item configuration, cart and tracking | Restaurant identity, images, prices and all order states             |
| Owner portal and Menu Studio                      | Navigation, editor, preview, lists, tables and billing/settings      |
| Kitchen and staff tools                           | Readable tickets in both modes; no forced dark-only shell            |
| Shared overlays                                   | Dialogs, sheets, dropdowns, tooltips, toasts, popovers and skeletons |

First visit follows the system appearance. An explicit Light / Dark / System choice persists per device. Signed-in account preference may sync, but guests never need an account to choose appearance. Follow OS changes only while System is selected.

Apply appearance before the first paint to prevent a light flash on a dark preference. Keep server/client initial theme handling consistent and test reload/navigation. Set native control color scheme appropriately. Do not partially invert a page with hard-coded surfaces.

Kitchen follows the chosen preference and may offer an explicit device override for ambient conditions. Public restaurant accents require validated light and dark pairs; brand customization cannot recolor operational status meanings. Provide appropriate logo variants and preserve actual food photography colors.

## Semantic token contract

Within the selected Ink & Ember system, define paired values for background/foreground, card/foreground, popover/foreground, primary/foreground/hover, secondary/foreground, muted/foreground, accent/foreground, destructive/foreground, border, input and ring.

Add status, chart and sidebar pairs where used. Separate decorative borders from control boundaries that must be perceptible. Component states must include hover, focus, pressed, selected, disabled, loading, error and success in both modes.

Raw colors live in theme variables; Tailwind semantic utilities and shared shadcn/Radix primitives consume them. Use the selected Ink & Ember palette as the base; final state and gradient pairs still require testing. Candidate swatches are exploration data, not an implementation-ready accessibility certification.

All earlier kitchen-only overrides and light-only marketing/guest policy are superseded. Theme scope is the whole app. The Collection 01 palettes are also superseded by the user's vivid-white / charcoal-gold-orange requirement.

## Component foundation

Use shared shadcn/Radix primitives consistent with the repository. Nova remains an exploration reference, not a selected preset. Verify CLI/preset compatibility at implementation time; do not claim the starter is configured for a preset it lacks.

Prioritize Button, Input, Label, Textarea, Select, Dialog, Sheet, Tabs, DropdownMenu, Tooltip, Badge, Table, Skeleton, Alert and Toast. Compose DishRow, AvailabilitySwitch, Money, OrderStatusBadge, ConnectionBanner, EmptyState and KitchenTicket from them.

Use inline field validation and durable saved/error states; toast feedback is supplementary. Destructive actions name the affected item. Disabled actions explain why. Keyboard alternatives accompany drag-to-reorder. Essential status is never color-only.

## Layout and interaction requirements

- Mobile-first guest experience with visible restaurant/table context, readable prices and explicit required variants.
- Desktop Menu Studio should support efficient editing and a live mobile preview when space permits. Mobile switches explicitly between Edit and Preview.
- Guest cart has safe-area spacing and does not cover content/focus. Free menus do not show unusable ordering controls.
- Kitchen tickets show number, table, quantities, variants, notes, elapsed time and one next action; connection health remains visible.
- Buttons default to at least 44px touch height; kitchen actions can be larger.
- A 4px spacing base is shared; final button radius/density remains part of the pending button selection.
- Motion should help orientation, respect reduced motion and never convey essential information alone.
- Use an appropriate Devanagari font when Hindi is introduced; no unreviewed automatic translation is published.

## Acceptance before app-wide release

Test every route and overlay in Light and Dark, including direct load, refresh, navigation, OS preference change, explicit override and persistence. Check charts, native inputs, logo variants, image fallbacks, empty/error/loading/disabled states and stale/offline indicators.

Verify 360, 390, 768, 1024 and 1440px layouts; 200% text zoom; keyboard-only use; reduced motion; long dish names; Hindi; missing imagery and network failures.

Target WCAG 2.2 AA: ordinary text 4.5:1, large text and required non-text boundaries 3:1. Validate rendered states including opacity, not only palette pairs. A dark kitchen screenshot alone does not satisfy the app-wide requirement.

Reference: [shadcn semantic theming](https://ui.shadcn.com/docs/theming).
