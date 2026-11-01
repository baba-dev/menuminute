# QR menu Quick Start

Quick Start is an opt-in three-screen journey for owners who want to publish a QR menu before configuring advanced hospitality operations.

- Entry: `/onboarding?quick=1` or the switch on the first onboarding step. Existing five-step onboarding remains available.
- Screen 1: restaurant name and type; screen 2: country, pricing currency and timezone; screen 3: review, confirm timezone/currency, create a **private** outlet draft.
- Quick Start never creates speculative tables and does not activate online ordering, Kitchen Pro, payments or fiscal tools.
- Both paths save to the existing `/api/onboarding` idempotent service and preserve server-owned draft recovery. Session storage holds only the current screen and journey preference, never an authorization decision.
- The post-create checklist derives from verified persisted state. Its primary action takes owners to their first incomplete milestone (add dishes, publish, QR) and never treats a draft as public.
- Check the route on mobile with keyboard-only navigation, lost-network autosave, a returning account, and a restored provisioning request before deploying. Keep the normal five-screen setup exercised in E2E as a regression gate.
