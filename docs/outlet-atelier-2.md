# Settings 2.0 — The Outlet Atelier

Private route /dashboard/settings. Editorial theme follows Dashboard and Service Counter, using original CSS-only decorative artwork without hardcoded operational facts.

## Editing and trust boundaries

GET is member-only and outlet scoped via the persisted context selector. A manager may save only restaurant description, guest-facing contact/address, and two validated hex brand tokens; others see a disabled, view-only profile. Names, currency, timezone, country, fulfillment modes, ownership, subscription activation and account security are linked to existing audited operations and **cannot** be changed by this new profile endpoint.

The JSON PATCH enforces exact-origin JSON mutation through requestActor(req,true), active session and MFA protections, outlet.manage through withOutlet, organization/outlet equality, SQL SECURITY DEFINER authorization and validation, optimistic profile_version, and an audit log. The application DB role retains no direct UPDATE privilege. Failed conflicts do not overwrite another manager's work. The plan card reads actual billingState only for its authorized callers; it never implies a paid entitlement based on the UI. No public SEO indexing.

## Checks

PostgreSQL integration verifies persistence, normalization, audit, permission isolation, stale-write conflicts, unexpected-field rejection and currency immutability. Playwright exercises save/reload, conflicts across two sessions, responsive 360/390/768/1024/1440 viewports, private robots metadata, and theme toggling. Visual approval includes light/dark, 200% zoom, keyboard and mobile address inputs. Migration 0017 is additive and requires standard migration-owner deployment preflight.
