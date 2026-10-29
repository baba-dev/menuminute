# Kitchen operator access — seven-day trial and revocable permanent grant

This release adds **operator-issued Kitchen Pro grants**, not automatic customer billing and not uncontrolled public enablement.

## Access model

- **Online Ordering grants:** existing flow, unchanged.
- **Kitchen trial:** an MFA-confirmed superadmin issues a 7-day `kitchen.new` organization entitlement in Admin → Payments & Grants.
- **Kitchen permanent:** an MFA-confirmed superadmin issues a revocable, no-scheduled-expiry entitlement using the explicit UTC 9999-12-31 sentinel. This is not an invoice, subscription payment, or representation of merchant purchase.
- **Outlet activation:** under Kitchen Control Desk, select **Activate operator-granted Kitchen**, supply actual reviewed evidence and the exact deployed 40-character release SHA, then complete a fresh password+TOTP step-up.
- **Single-admin constraint:** this operator route runs only when exactly one verified MFA-enrolled superadmin exists; deployments with multiple privileged operators retain the independent request/approve/activate pilot workflow.
- **Readiness:** active station, eligible staff, published and fully routed dishes, active Online Ordering entitlement, active Kitchen grant, no in-flight Kitchen tickets; PostgreSQL recomputes all conditions.
- **Drain:** stop intake, finish already accepted tickets, then finalize disable. Entitlements cannot be revoked while any kitchen outlet is enabled. An expired grant blocks new intake; it never silently converts Kitchen orders to the merchant board.
- **Tenant boundary:** grants are organization-scoped; an operator may only activate a specific reviewed outlet. No employee role or outlet permission is changed by a grant.
- **Commercial boundary:** Razorpay Kitchen Pro checkout and subscription plan publication remain **disabled**. The operator grant is a manual administrative entitlement, not a provider-verified payment.

## Operational steps

1. Verify the deployed immutable web/worker release SHA, migrations, off-host backup + isolated restore, alerting, end-to-end behavior, accessible mobile UI, queue failure recovery, and shared ERP capacity; record genuine results in #76 and #77.
2. Grant Kitchen Pro trial/permanent in Admin → Payments & Grants to the selected organization using single-use password/TOTP confirmation. Audit reason documents why.
3. Configure active Kitchen stations, roster and all dish routes; verify ordering entitlement.
4. Use Admin → Kitchen Control Desk → **Activate operator-granted Kitchen** with exact SHA, evidence URL and operator justification; confirm a new one-use password/TOTP proof.
5. Verify a newly accepted test order routes to the assigned Kitchen station and can reach Ready through the expeditor. Existing orders remain unchanged.
6. Use drain/finalize before revoking, and monitor operations continuously.

## Review requirements

- Keep the new migration 0036 forward-only and check its verification against production's migration journal.
- Run exact-head TypeScript, ESLint, formatting, PG/Redis integration, ARM64 browser and aggregate CI gate.
- Audit `SECURITY DEFINER` rights: only qualified live superadmin sessions with one-use step-up may issue and activate; no runtime table writes.
- Test single-admin and two-admin denial paths, operator grant overlap/replay/revocation, explicit SHA binding, state transitions, ordered worker events, and cross-tenant denial.
- Operator evidence URLs link to human sign-off; they are **not** automatically validated as proof of QA.
- A merged PR does not by itself issue a grant or activate production. These are separate authorized operations in the running application.
