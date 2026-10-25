# MenuMinute Feature Access & Trials — operator guide

This is an administration workflow, not staff or outlet role management. The server still enforces tenant isolation, outlet permissions, and commercial entitlements separately. **Kitchen Pro is not commercially enabled.**

## Quick steps

1. Open **Platform Admin → Payments & Grants → Operator Entitlements**. Select **New access grant**.
2. Search the restaurant **by name**. Select the matching organization and confirm the parent organization; access applies to every outlet in that organization.
3. Choose **Online Ordering**, **INR/USD platform billing currency**, and a window preset. First User Bonus defaults to **90 days**, 7-Day Trial is seven days, 30-Day Trial is thirty days, Paid Subscription is a _manual 30-day record_ and requires separate payment verification, and Custom allows arbitrary dates. All start/end inputs use the browser's local time and are converted to UTC for persistence.
4. Enter an audit reason. Within the same modal, confirm your account password and six-digit TOTP. The existing protected /api/security/step-up mechanism creates a session-bound, single-use 5-minute proof. Submit **Confirm & issue**.
5. Check **Grants & history** for the new entry. Use **Extend** for a scheduled successor that starts at the existing end timestamp (not a historical row rewrite), **Revoke** for immediate loss of new-work entitlement, and **History** to view all recorded windows for the organization. Mutations require a new privileged confirmation each time.

## Important safeguards

- New accepted orders are checked against active `ordering.new` entitlements. Pre-existing accepted work can still be completed after expiry or revocation; do not delete their history.
- Kitchen Pro is blocked at the UI, `app_private.admin_command`, and the default-disabled outlet KDS flag. The release gates in [Kitchen Pro readiness](kitchen-pro-e-h-readiness.md) must be independently satisfied and a separate activation reviewed.
- The operator admin only authorizes **commercial feature windows**. Organization ownership, individual roles, POS permissions, and outlet-station authorizations remain unchanged.
- Online Ordering grants are not receipts, invoices or proof of payment. Paid presets record a manually verified subscription term; no external payment occurs in this workflow.
- Adjacent future renewal windows are allowed; overlapping non-revoked grants are rejected by the database, even if the browser's preview is incomplete or stale.
- Existing grant records remain immutable through extensions: each renewal is a new, audited grant. Retain revoked and expired entries for investigation.
- Avoid disclosing raw PostgreSQL errors or TOTP/password values in React Server Action return values or client logs. The step-up endpoint already validates JSON origin, verifies the active session, and rate-limits attempts.
- For large organizations, initial history is paginated (50 per page). Browser-side status filters apply to loaded records, not an implied complete search of all server records.

## Acceptance tests before production merge

- Search by restaurant name, organization name and invalid/wildcard query; verify a non-admin cannot access.
- Check preset date conversions under a non-UTC timezone and mobile input.
- Grant ordering with valid one-time step-up, deny missing/expired/replayed proof, reject overlapped windows.
- Test renew → successor starts exactly at old end → original unchanged → duplicate renewal rejected.
- Revoke with step-up; verify new guest orders disabled but accepted work can finish.
- Confirm Kitchen Pro grant still fails in DB and commercial plan stays disabled.
- Review keyboard navigation, focus management, reader labels, escape/close behavior, mobile scrolling, contrast and 200% zoom.
- Verify latest-head ARM64 quality gates and isolated PostgreSQL integration, then operator smoke-test on an approved disposable organization. Never seed live customer orders as test fixtures.
