# Product roadmap

## Current baseline

The repository contains a Phase 0 SQLite/NextAuth scaffold: menus, QR generation, owner management,
order schemas/preview pages, AI stubs and baseline CI. This is not the approved production architecture
and does not establish production reliability or measured capacity.

## Approved delivery sequence

Follow `implementation-plan.md` for engineering gates:

1. PostgreSQL + Drizzle/pg, Better Auth database sessions, organization/outlet isolation and AMD64 CI.
2. Redis queue/cache separation, BullMQ and recoverable PostgreSQL outbox/work state.
3. Restaurant onboarding, public QR menus, variants, validated media and publication.
4. Dine-in guest ordering, staff acceptance, customer status and resilient KDS.
5. Reviewed AI menu import, descriptions, translations and image suggestions; Ink & Ember refinement.
6. Measured performance, tested restoration, operational alerts and commercial launch gates.

## Commercial scope

Free permanent QR menus remain the acquisition product. Subscription entitlements enable ordering
and KDS. Earlier INR 149/299 figures are planning assumptions, not validated pricing or a payment
integration commitment. Launch diners pay at restaurant. Restaurant SaaS billing collection/renewal
operations must be specified before a paid launch; a payment gateway is not implicitly selected.

Delivery, online diner payments, WhatsApp/SMS, multi-station routing and advanced analytics are later
scope. Do not label these available until implemented and verified.
