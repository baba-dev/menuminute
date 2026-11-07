# Product roadmap

## Current implementation baseline (17 October 2026)

Phase 0 agent ownership/orchestration and Phases 1–3 implementation have merged: PostgreSQL 17 with Drizzle/pg, Better Auth sessions and scoped tenancy, independent Redis queue/cache, durable PostgreSQL outbox/BullMQ, organization/outlet/role management, versioned Menu Studio, private reviewed media, permanent QR identities and an anonymous public menu. The earlier SQLite/NextAuth scaffold described in historical notes is **not** the current production architecture.

Phase 4 — [Perfect Free QR Menu](orchestration/phase-4.md), tracked by [execution epic #37](https://github.com/baba-dev/menuminute/issues/37), refines the existing free product instead of creating a second editor. The shared Ink & Ember primitives, canonical dashboard, safe create/publish, guest QR revocation recovery, honest public product descriptions, guided onboarding, selected-QR printing and accessible dish controls are scoped in independently tested PRs. See [acceptance matrix](orchestration/phase-4-acceptance.md) and [operator evidence](orchestration/phase-4-ops-evidence.md). **Merged code and successful CI do not certify the entire Phase 4 production exit gate.** Check current GitHub PR/main SHA and actual host release separately; do not infer deployment from this document.

## Approved delivery sequence

1. Phase 0: agent orchestration, exclusive path reservations and architecture decisions — implemented.
2. Phase 1: PostgreSQL/Drizzle, Better Auth, tenancy/RLS and native ARM64 CI — implemented.
3. Phase 2: independent Redis workloads, BullMQ/outbox, organizations/outlets/roles and billing entitlement foundations — implemented.
4. Phase 3: Free QR Menu foundation, versioned Menu Studio, private/approved media and anonymous QR browsing — implemented in the repository.
5. Phase 4: make Free QR Menu merchant-ready: Ink & Ember Light/Dark/System, guided onboarding, canonical dashboard, safe editor and guest experience, reviewed media and permanent print-friendly QR; exact-final-SHA CI, independent product review and operator-backed restore/ERP evidence remain explicit exit requirements.
6. Following Phase 4: dine-in and pickup ordering, closing-time expiry, authoritative pricing, staff acceptance and resilient Kitchen Display System, with separate scope and safety gates.
7. Merchant-reviewed AI menu import, descriptions, translations and image suggestions; budget/quota/fallback controls, never autonomous publication of dietary/allergen claims.
8. Commercial collection/renewal, operational monitoring and measured capacity; validate restored SQL+media, external alerting, ERP coexistence and agreed SLO/RPO/RTO.

## Commercial scope

Free permanent QR menus remain the acquisition product, and Free already accepts guest orders up to 100 a month. Approved prices (owner-approved 2 November 2026): **Ordering ₹119, Kitchen Pro ₹499 flat for up to ten outlets, Dedicated ₹30,000 by contract** (USD $5 / $20 / $3,000 on-premise). The earlier ₹149/₹299 figures are superseded and must not be advertised.

Ordering and Kitchen Pro are **built, but purchasable only when their runtime switches are on**: Razorpay checkout is off by default until provider configuration, smoke tests and the legal launch gates pass, and Kitchen Pro has an independent commercial release gate (#76/#77). The public pricing page reads those switches, so it offers purchase only when checkout can complete and otherwise offers a free start (Ordering) or an early-access request (Kitchen Pro). See [commercial availability](commercial-availability.md) for the decision, the switches and the opening checklist. USD has no checkout. Worldwide outlets select supported local transaction currencies. Initial launch diners pay at the restaurant or pickup counter.

Delivery, online diner payments, WhatsApp/SMS, multi-station routing and advanced analytics remain later scope. Never show preview features as live entitlements.

## Approved launch envelope

Read [product requirements](product-requirements.md): worldwide multiple organizations/outlets, outlet-type journeys, permanent QR identity, flat variants/add-ons and scoped role permissions. The 25-owner / 50-outlet / 1,000-order-per-hour envelope is a **planning target, not measured production capacity**. Host-backup operation, an isolated matching SQL+media restore, off-host alerting and co-hosted ERP resource measurements require separate operator evidence before launch sign-off.
