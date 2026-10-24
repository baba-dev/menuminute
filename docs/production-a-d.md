# Production completion A–D

**Implemented:** checkout reliability, product truth, scheduled pickup and operational UX. The append-only `0020_checkout_scheduling` migration preserves existing orders and adds nullable pickup timing, bounded outlet scheduling controls and versioned Terms acceptance fields.

## Checkout reliability

Before sending, the guest client stores the exact request and idempotency key in session storage. An unknown response is recovered with that original payload; editing requires explicitly discarding the uncertain attempt. The server still resolves a committed request before reading the current catalogue. Saved carts are reconciled against the published dish, variant, add-on availability and current prices. The cart and API share 50-line and 999-unit technical limits; the server remains authoritative for availability and totals.

## Scheduled pickup

Pickup orders require an ISO instant. The service validates outlet-local slot alignment, configured preparation lead time, advance window and the selected dishes' service schedules. PostgreSQL repeats the lead/advance checks and stores `requested_fulfillment_at`. Merchant order views show the due time in the outlet timezone. Authorized outlet managers configure preparation, slot and advance limits with optimistic versioning and an audit entry.

## Product truth and operations

Terms v2026-10-24 are public and registration records the accepted version/time through Better Auth additional fields. Public ordering copy now describes the gated capability and its acceptance/payment boundaries. The footer no longer labels live ordering, contact and Terms as upcoming. Admin-visible entitlement state disables unavailable Orders/Kitchen navigation, while non-admin navigation remains permission-authoritative. The dashboard reads the order ledger for current attention counts when the actor has access.

## Failure and rollback

Migration 0020 is expand-only. Existing users have nullable acceptance history and existing orders have no requested pickup time. Disable the new application release without removing columns; do not down-migrate customer data. If an uncertain checkout cannot be reconciled, keep the stored key and ask the guest to check again. No payment capture or autonomous acceptance is introduced.
