# AI Dining Concierge 1.0

Guest-facing meal discovery on public menus. This feature does not create menus, change dish prices, bypass the dish customizer, submit orders, or run Ember tools.

## Controlled rollout

Default OFF. Set these on the web server after confirming the provider's commercial entitlement and an appropriate API spending limit:

- AI_FEATURES_ENABLED=true
- AI_NVIDIA_ENABLED=true
- AI_NVIDIA_COMMERCIAL_APPROVED=true
- NVIDIA_API_KEY=secret web-only runtime value
- AI_NVIDIA_MODEL=approved text-capable NVIDIA NIM model
- AI_DINING_CONCIERGE_ENABLED=true
- AI_DINING_CONCIERGE_OUTLET_IDS=comma-separated exact outlet IDs

The concierge calls only the existing NVIDIA chat adapter in text/JSON mode. Cloudflare AI settings remain entirely separate for Ember. Nothing falls over to Cloudflare. If NVIDIA is unavailable or returns an invalid selection, server-validated deterministic meals are returned with an explicit curated label.

The first rollout is operator-controlled per outlet through the exact allowlist; self-service merchant UI controls and explicit course-role editing are not included. Do not claim merchant self-service activation. The published menu is the only source of recommendable dish IDs.

## Security and pricing

- POST /api/public-menu/[token]/concierge requires a server-attested client IP and a valid non-revoked public menu token. Nginx must inject the same validated edge headers as the existing public-menu route.
- Atomic Redis limiter enforces 8 attempts per IP+token per hour, 240 per outlet, 2,000 globally. Redis errors fail closed before inference.
- Bounded request payloads and strict contracts prevent unbounded user-input costs. Guest and menu text are untrusted data, never instructions.
- Published status, outlet scope, sold-out/availability schedules, verified free-from flags and guest budgets are checked before the model sees candidates.
- AI output is checked against a server-owned candidate list. All prices and totals are calculated in integer minor units. This is an estimated subtotal, not a checkout bill.
- The existing item customizer is mandatory for dishes with variants or required add-ons. The customizer sequence commits the group only when all mandatory choices are completed.
- Guests may browse without online ordering. If the menu revision changes, regenerate recommendations. Actual order authorization and prices remain enforced by the standard public order flow.
- Never tell guests food is allergy-safe on missing or inferred ingredient data. Ask staff about allergies and cross-contact.

## UI QA and rollout

1. Enable for a test outlet with published dishes; confirm classic search still works before, during and after the wizard.
2. Check each mode, mood, restriction, guest count, budget and free-text request; include impossible budgets and menus without suitable dishes.
3. Test simple dishes and dishes with variants/add-ons. Confirm cancelling the customizer doesn't add partial orders.
4. Verify mobile screens, dialog focus restore, keyboard Escape/Tab, reduced motion, dark mode and overflow.
5. Verify revoked token 404, rate limit 429, Redis/edge failure 503, NVIDIA timeout fallback, and no Cloudflare calls.
6. Verify availability updates, price overrides and cart reconciliation.
7. Run pnpm typecheck, pnpm lint, pnpm test, pnpm build and browser smoke checks in CI. Roll out to one outlet before expanding.

## Not in scope

Automatic financial activation, bundled merchant discounts, guaranteed allergen-free meals, public AI tools, saved guest profiles, and self-service merchant settings. Structured dish course-role and serving-size editing needs separate schema review.
