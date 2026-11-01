# Settings information architecture

Status: implemented by issue #263. This document records ownership and routing; it does not grant
permissions or replace the service authorization checks.

## Why the pages were reorganized

The previous interface split one outlet across two places: operational identity was edited from
Organization, while public profile, location, branding and pickup policy lived in Settings. Account
also mixed personal identity with tenant administration links. The visual hierarchy made these
boundaries harder to understand and repeated navigation cards for billing, people and security.

The three pages now follow the entity that owns the setting:

| Area             | Route                     | Owns                                                                                                                                                    |
| ---------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Personal account | `/account`                | Verified identity, security entry point, default workspace, theme/device preference, privacy and sign-out                                               |
| Active outlet    | `/dashboard/settings`     | Name, country, transaction currency, timezone, outlet type, fulfillment, public profile, contact/location, colors and pickup policy                     |
| Organization     | `/dashboard/organization` | Organization name/status, outlet creation, memberships, invitations, outlet grants, brands, billing, delivery diagnostics, audit and ownership transfer |

All three pages use the same scope navigation. A stored default workspace remains a preference, not
authorization. The current membership and outlet grant are rechecked by the existing services.
The Account page is part of the authenticated dashboard route group, so it uses the same sidebar,
top command bar, outlet context, responsive navigation and session banners as Organization and Outlet
Settings while keeping its fields personal.

## Write paths and concurrency

| Setting group                             | API/service                                                                                | Concurrency authority                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------- |
| Outlet operational identity               | `PATCH /api/organizations/:organizationId` → `manageOrganization`                          | Organization version and idempotency key    |
| Outlet public profile                     | `PATCH /api/organizations/:organizationId/outlets/:outletId/profile` → `saveOutletProfile` | Outlet profile version                      |
| Default workspace                         | `POST /api/context` → `selectWorkspacePreference`                                          | Current active membership and outlet access |
| Organization, roles, brands and ownership | `PATCH /api/organizations/:organizationId` → `manageOrganization`                          | Organization version and idempotency key    |

Moving a form did not create a second mutation route. Currency and country are selected from the
same runtime-supported catalogs validated by the server, and timezone choices continue to come from
the database-backed timezone registry. Historical orders and prices are not rewritten.

## Deliberately separate pages

- Password, MFA and session revocation remain in `/account/security` because they are sensitive
  identity operations rather than ordinary profile fields.
- Device and installed-app behavior remains in `/dashboard/settings/device`, linked from the
  personal preferences card.
- Menu publication, QR lifecycle, service points, operating hours, tax/fiscal policy and POS settings
  remain in their domain workspaces. They should not be copied into these general settings pages.
- Outlet creation remains organization-scoped. Editing an existing active outlet now happens only in
  Outlet Settings.

## Known product gaps not disguised as settings

- The application does not yet provide a self-service verified name or email change workflow.
- Account deletion remains a reviewed process rather than an immediate destructive button.
- Changing an outlet currency with existing prices still requires the guarded repricing workflow.
- A cross-outlet administrator must switch the active outlet before editing that outlet. A future
  outlet switcher can improve this without weakening the active-outlet boundary.
