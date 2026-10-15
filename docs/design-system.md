# MenuMinute — Shared design and theme contract

Status: **approved design direction, 14 October 2026**. The user selected **Ink & Ember**, then approved **Ember Flow for everyday actions** and **Ink Press for a stronger tactile feel**. The earlier flat buttons are excluded.

This document, the [approved gradient button contract](button-options.md) and the [feedback/motion contract](feedback-and-motion.md) define the implementation direction. Earlier brochures are visual references; their unselected options do not override this decision.

## Confirmed visual direction constraints

- Light: pure white canvas/working surfaces, near-black ink, vivid saturated controls and graphic accents. Do not replace these with tinted linen, sage or pastel washes.
- Dark: charcoal surfaces, gold primary emphasis and orange editorial/detail accents, with high-contrast readable text.
- Character: expressive headings, selective marker underlines, offset ink frames and small handwritten chef's notes, inspired by Creators' Pencil & Pixel.
- Food identity: steam, plate outlines, ingredients and ticket details replace studio/cursor imagery. Ink & Ember's Bricolage/DM Sans/Kalam roles and base palette are selected; the approved gradient stops and final component states still require implementation verification.
- Keep ordinary controls, prices, financial/security content and kitchen instructions precise. Handwriting is a decorative annotation role only.
- Use at most one focal sketch gesture per main viewport and avoid stacking decoration on every card. Brand character should never obscure food or service state.

## Approved button hierarchy and implementation

Use Ember Flow as the default for everyday actions: cart, save, continue and routine service updates. Use Ink Press for selected focal actions such as publishing a menu or a prominent first-menu CTA. Keep the latter sparse; the stronger tactile edge loses meaning if repeated everywhere. Secondary and destructive actions preserve their own semantic hierarchy.

Build both as variants of one shared component. Use short directional hover/press cues, explicit pending labels, duplicate-action prevention, server-acknowledged success and recoverable errors. Respect reduced motion. Do not turn the demonstration's fixed delays or automatic resets into production logic.

Next: refine and verify all state tokens, prototype the approved guest/owner/kitchen treatments, then apply them throughout the app. Design selection is complete; implementation is not claimed by this documentation PR.

## Canonical base tokens

| Role                       | Light                 | Dark                  |
| -------------------------- | --------------------- | --------------------- |
| Canvas                     | `#FFFFFF`             | `#111111`             |
| Card/popover               | `#FFFFFF`             | `#202020`             |
| Foreground                 | `#171717`             | `#FFFFFF`             |
| Supporting text            | `#555555`             | `#BEBEBE`             |
| Raised/quiet surface       | `#F5F5F5`             | `#2C2C2C`             |
| Primary brand              | `#FF5B1A`             | `#FFC83D`             |
| Gold detail                | `#FFD23F`             | `#FFC83D`             |
| Orange detail              | `#FF5B1A`             | `#FF7A1A`             |
| Readable orange annotation | `#A83500`             | `#FF7A1A`             |
| Decorative divider         | `#D7D7D7`             | `#505050`             |
| Success fill/text          | `#067345` / `#FFFFFF` | `#4DDD9B` / `#10251A` |
| Gradient start             | `#FF5B1A`             | `#FFD54B`             |
| Gradient middle            | `#FF8A1E`             | `#FFB52C`             |
| Gradient end               | `#FFD046`             | `#FF7A1A`             |
| Gradient foreground        | `#211600`             | `#211600`             |

The divider is decorative, not an accessible control boundary by itself. Focus, inputs, destructive/warning/info pairs, charts and disabled states require explicit semantic values and rendered-state checks during implementation. Do not use saturated orange text on white where the readable annotation token is needed.

## Typography and geometry

- Bricolage Grotesque for display headings; DM Sans for body, controls, prices and operations.
- Kalam for short decorative chef's notes only; never instructions, prices, security or required choices.
- Body target 16/24px, controls 14/20px, editorial display 40–64px, kitchen item text 18–24px.
- A 4px spacing base, 14px standard cards, Ember Flow 13px buttons and Ink Press 9px buttons; larger editorial panels may use 24px.
- Tabular numerals for aligned prices, ticket quantities and timers.

## Approved feedback hierarchy

The user approved **A routine / B milestones / C optional guidance**:

- **A — Service Card**: standard dialogs, focused decisions and forms.
- **B — Ink Ticket**: first publication and occasional important milestones.
- **C — Chef's Note**: dismissible onboarding/contextual tips; never required instructions or error content.

Use inline semantic alerts, compact toasts and persistent recovery states at the appropriate task scope. Follow [feedback-and-motion.md](feedback-and-motion.md) for placement, copy, focus, loading, error recovery and motion targets. Exact animated art and timings are verified during prototype acceptance; the hierarchy is approved.

## App-wide Light / Dark / System support

This is a confirmed user requirement for the approved system.

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

Raw colors live in theme variables; Tailwind semantic utilities and shared shadcn/Radix primitives consume them. Use the selected Ink & Ember palette as the base; final state and gradient pairs still require testing. Approved base tokens do not replace full component-state accessibility verification.

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
- A 4px spacing base is shared; button geometry follows the approved Ember Flow / Ink Press variants.
- Motion should help orientation, respect reduced motion and never convey essential information alone.
- Use an appropriate Devanagari font when Hindi is introduced; no unreviewed automatic translation is published.

## Acceptance before app-wide release

Test every route and overlay in Light and Dark, including direct load, refresh, navigation, OS preference change, explicit override and persistence. Check charts, native inputs, logo variants, image fallbacks, empty/error/loading/disabled states and stale/offline indicators.

Verify 360, 390, 768, 1024 and 1440px layouts; 200% text zoom; keyboard-only use; reduced motion; long dish names; Hindi; missing imagery and network failures.

Target WCAG 2.2 AA: ordinary text 4.5:1, large text and required non-text boundaries 3:1. Validate rendered states including opacity, not only palette pairs. A dark kitchen screenshot alone does not satisfy the app-wide requirement.

Reference: [shadcn semantic theming](https://ui.shadcn.com/docs/theming).

## Outlet-specific experience

Apply [product requirements](product-requirements.md): onboarding asks outlet type; navigation and
ticket actions emphasize dine-in, pickup or shared-brand cloud-kitchen work within role permissions.
Mixed outlets label fulfillment; pickup completes as Collected. Sold-out dishes remain visible with
greyed imagery, Sold Out overlay and accessible text, including image fallbacks. Currency formatting
uses outlet-local currency independently of platform USD/INR billing. Complete UX review remains a
separate gate; keep all approved Ink & Ember, theme, button and feedback contracts above.
