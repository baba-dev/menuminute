# Signup and onboarding A–H release notes

## Principle

Keep email-and-password signup fast. A verified email is required before tenant data access. **Do not require TOTP/MFA for ordinary users**, including new owners and ordinary member accounts. Accounts may opt into MFA. Retain fresh TOTP step-up for protected high-risk changes such as transferring ownership or granting an administrator role; explicit existing organization policies are not silently cleared.

## Entry journeys

- `/start`: initial restaurant creation, joining an existing team via an email-bound invitation, and adding another outlet under an existing owned/managed organization are distinct choices.
- `/onboarding` provisions a first owned organization/outlet; authenticated owners who already have outlets use their organization manager for subsequent locations.
- `/join-team` only parses invitation tokens and routes to the existing verified-email-bound acceptance. It never grants membership itself.

## Recovery and data privacy

Onboarding autosave is disabled when loading progress fails, and the user can retry without overwriting the draft. A pending provisioning request is replayed with its durable key and without rewriting draft content. Completed progress has its private draft cleared. A previously completed but inaccessible workspace does not redirect indefinitely.

## Verified launch checklist

Progress is read from the real tenant-scoped restaurant record, persisted dish content, the actual public published release, guest-ready QR identity, and actual entitlement/operations state for optional goals. Viewing a page, selecting goals, a default empty menu, or simply creating a QR token cannot complete a step.

## Medium-priority improvements

Shared 249-country ISO alpha-2 validation, 72 common currency recommendations with explicit manual review for remaining countries, currency/timezone confirmation, account-scoped session progress, accessible radio navigation, contrast, and transient-form-validation safeguards.

## Release checks

- Apply forward-only migration `0032_optional_mfa_for_new_organizations.sql`. It changes the **default for new organizations only**; no existing MFA policy or enrolled factor is erased.
- Verify production registration with genuine Turnstile site and secret keys together; browser mocks are not proof of production challenge delivery.
- Verify full signup-email-click-login flow including a new invited teammate; the delivered confirmation URL must preserve its safe intended destination.
- Run PostgreSQL integration tests for provisioning, timezone, invitations, MFA, and the new readiness tests.
- Run Playwright desktop/mobile and reduced-motion checks, including offline GET restore, lost POST response, actual saved dish/public menu/QR readiness, signup without consent, and optional MFA.
- Check production mailing delivery, rate limits, origin/CSRF, prepared statements/RLS, and `/api/context` when organizations are disabled.
- Do not merge until all required GitHub Actions gates pass on the exact PR head. Keep release and deployment safeguards intact.

## Operational note

No new user-facing feature toggles or paid subscriptions are granted automatically. For operational goals the checklist deliberately marks a feature incomplete when authoritative capability or business-state checks cannot confirm readiness.
