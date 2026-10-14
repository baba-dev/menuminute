# MenuMinute — Execution roadmap

Direction baseline: 14 October 2026. Read [product direction](product-direction.md) and [design system](design-system.md) first. Phases describe required outcomes, not a claim of production readiness.

## Phase 0 — Existing foundation

The starter repository contains Next.js/TypeScript, SQLite/Drizzle migrations and seed data, authentication and tenant service scaffolding, menu category/item CRUD, a public menu, QR generation, tests and CI configuration. Orders and Kitchen are preview routes; AI services are stubs and the R2 adapter is planned. Current UI is orange/Inter. Existing test files and earlier commit reports are not a substitute for running checks on the final implementation SHA.

## Phase A — Design foundation and complete free menu

- Await the user's Collection 02 choice (01 Ink & Ember, 02 Ticket & Flame, 03 Market & Marker) or a specified hybrid; then refine paired semantic tokens, typography and a focused prototype. Collection 01 is rejected. Honor vivid color on white in light mode and charcoal/gold/orange in dark mode.
- Implement the accepted shared shadcn/Radix components and layout shells with app-wide Light / Dark / System support, including marketing, authentication, guests, owner tools, overlays and kitchen.
- Complete onboarding, restaurant details, category/item editing, variants, availability, accessible reordering and menu publication states.
- Implement Menu Studio desktop editor/preview and mobile Edit/Preview.
- Provide logo/cover uploads, responsive menu images and local SVG fallbacks.
- Deliver stable public menu URLs, downloadable SVG/PNG QR and branded printable PDF.
- Run early owner tests: create, publish, scan, edit without reprinting.

Gate: complete manual flow with no provider keys; tested tenant isolation; validated mobile/keyboard/zoom behavior; actual phone scan and printed QR checks; no order/PWA claims for preview features.

## Phase B — Optional assisted setup

- R2 storage adapter with bounded uploads, derivatives and deletion rules.
- Gemini OCR import, descriptions and reviewed translations.
- Owner-approved curated/Pexels image suggestions with provenance.
- Quotas, durable jobs, retry limits and manual fallback. Generated imagery is optional and gated separately.

Gate: imports remain editable drafts; no invented prices/allergens; exhausted quota cannot trigger spend; approved images survive deployment; missing provider has no effect on Phase A.

This phase improves onboarding and may run alongside free-menu pilots. It must not delay a reliable ordering pilot.

## Phase C — Ordering and subscription entitlement

- Table management and scoped table QR sessions.
- Guest cart, variant selection, server price/availability validation and idempotent submission.
- Staff order list, acceptance and full fulfillment lifecycle, guest-scoped tracking and history.
- Durable events, SSE reconnect/snapshot and polling fallback.
- Razorpay restaurant subscriptions with verified webhook processing and plan enforcement.
- Pay-at-counter guest flow; separate fulfillment from payment.
- Expiry disables new orders while preserving free menu access and controlled completion of active tickets.

Gate: duplicate-submit, cross-tenant access, stale-price, sold-out, invalid-table, rejected-order, concurrent action and subscription-expiry tests pass. No diner payment gateway or delivery integration.

Pilot Ordering at the proposed ₹149/outlet/month only after pricing terms and costs are validated.

## Phase D — Kitchen Pro and paid pilot

- One kitchen queue, touch-friendly ticket board, elapsed timers and role-scoped staff access.
- New/Accepted/Preparing/Ready views, visible connection health, bounded reconnect recovery.
- Sound enable/mute, visible new-ticket cues and appropriate device-session revocation.
- Installable PWA shell with explicit offline/stale behavior; no offline order replay.
- Basic counts and preparation-time summaries from durable events.

Gate: kitchen survives app restart/reconnect without lost/duplicate tickets; simultaneous staff actions reconcile; muted sound still leaves visible cues; physical phone/tablet usability validated. Pilot Kitchen Pro at the proposed ₹299/outlet/month after commercial validation.

Multi-station routing is explicitly deferred.

## Production gates — Start in A, required before any public/paid pilot

Do not leave operational correctness until after feature development.

- Actual Oracle ARM64 deployment rehearsal, Nginx/systemd, HTTPS, persistent data/media outside release folders.
- Measured SQLite lock behavior and request latency on the target machine; bounded worker concurrency.
- Offsite backups and demonstrated restore; proposed pilot targets RPO ≤1 hour, RTO ≤4 hours, verified before promised.
- Health checks, disk alerts, failed-job visibility, retention and account deletion policy.
- Tenant access, session security, rate limits and upload hardening.
- Final-SHA lint/format/typecheck/tests/build; targeted guest/owner/kitchen browser coverage; CI must be green before release.

## After pilot evidence

Multi-outlet management, multi-station routing, thermal printing, integrations, advanced reporting, inventory/POS/accounting, diner online payment and voice/conversational ordering require separate scope decisions. No ₹599 tier is committed.

Track pilot publication time, staff effort, reliable order completion, conversion and support cost. Fix observed workflow friction before adding another subsystem.
