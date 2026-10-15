# Product roadmap

## Current baseline

The repository contains a Phase 0 SQLite/NextAuth scaffold: menus, QR generation, owner management,
order schemas/preview pages, AI stubs and baseline CI. This is not the approved production architecture
and does not establish production reliability or measured capacity.

## Approved delivery sequence

Follow `implementation-plan.md` for engineering gates:

1. PostgreSQL + Drizzle/pg, Better Auth database sessions, organization/outlet isolation and ARM64 CI.
2. Redis queue/cache separation, BullMQ and recoverable PostgreSQL outbox/work state.
3. Outlet-type onboarding, scoped brands/outlets/roles, public QR menus, variants/add-ons, schedules and publication.
4. Dine-in and pickup ordering for restaurants/takeout/cloud kitchens, closing-time expiry, staff acceptance and resilient KDS.
5. Reviewed AI menu import, descriptions, translations and image suggestions; Ink & Ember refinement.
6. Measured performance, tested restoration, operational alerts and commercial launch gates.

## Commercial scope

Free permanent QR menus remain the acquisition product. Subscription entitlements enable ordering
and KDS. Earlier INR 149/299 figures are planning assumptions, not validated pricing or a payment
integration commitment. Launch diners pay at restaurant. Restaurant SaaS billing collection/renewal
operations must be specified before a paid launch; a payment gateway is not implicitly selected.

Delivery, online diner payments, WhatsApp/SMS, multi-station routing and advanced analytics are later
scope. Do not label these available until implemented and verified.

## Approved launch envelope

Read [product requirements](product-requirements.md). Worldwide scope, multiple outlets, local
transaction currencies and USD/INR platform subscriptions supersede earlier narrow pilot assumptions.
Target 25 owners, 50 restaurants/outlets and their menus, and 1,000 orders/hour, subject to measured
capacity and ERP coexistence. Complete UX flows and jurisdiction calculation rules are required
before affected implementation/release gates. Architecture documentation does not implement them.
