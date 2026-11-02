# Feature Activation & Gate Cleanup — slice A/C

Read-only superadmin route: `/admin/features` (issue #312).

The page distinguishes **configuration** from tested production operation and does
not write flags or grant entitlements. Global Kitchen approval is read through the
existing PostgreSQL authority; plan active state is read from the catalog. Razorpay
values are only checked for presence, never displayed. All other gates are
runtime/environment signals; worker-specific state is explicitly **unverified**.

The photo-import availability API now provides a non-sensitive reason while retaining
its existing `enabled` contract, and the capture wizard describes why extraction is
blocked. A configured web process does not guarantee worker availability. The POS
Ledger explains its advanced finance restrictions while ordinary cashier operations
remain accessible in POS.

## Manual acceptance checks

- Superadmin sees Feature Activation; an ordinary merchant cannot visit `/admin/features`.
- Empty/missing flags report unavailable, not configured; no API keys, exact outlet
  IDs, payment references, or provider model IDs appear in responses.
- Approved Kitchen plus active plan plus provider settings reports configured, not
  proof of signed webhook, payment or automatic outlet entitlement.
- No Web Push, guest offline, finance settlement, statutory tax or Ember action
  flag is changed by this PR. Device acceptance #249, Ember security #230, and
  Kitchen acceptance #76/#77 remain separate.
- When `MENU_IMPORT_NVIDIA_ENABLED` is false, merchants may keep private
  drafts and the wizard explains why extraction is unavailable. Other states
  identify missing commercial approval or model, without leaking secrets.

## Deployment

No migration or new secret. Render on server per request, under the existing
superadmin and 2FA guard. Use exact-head CI and staging visual/access testing
before merging.
