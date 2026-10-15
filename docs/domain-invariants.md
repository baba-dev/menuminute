# Domain invariants

Target requirements. These are not assertions that the scaffold already satisfies them.

## Identity and tenancy

- Every private operation requires current session, organization membership, restaurant and outlet scope.
- A client-provided restaurant/outlet ID is a selector, never proof of access.
- Cross-tenant relationships are rejected by composite foreign keys and service checks.
- Demo/default restaurant lookup is permitted only on explicitly public demo routes.
- Suspension and staff removal take effect for requests, jobs and live subscriptions.
- Guest order/read capabilities are opaque, scoped and limited; no sequential order-ID access.

## Money and order data

- Store amount in integer minor units plus ISO currency. Respect currency exponent (INR 2, OMR 3).
- Use checked integer/BigInt or decimal arithmetic at calculation boundaries; specify rounding order
  for discounts/tax. Serialize large integers safely; never assume all BIGINT values fit JS Number.
- Server prices, options, availability and entitlements are authoritative.
- Save names, variant/options, prices, taxes and totals as immutable order snapshots.
- Quantity and line count are bounded positive integers; negative totals are rejected.
- One scoped idempotency key maps to one canonical request hash and order result. Reuse with a
  different payload conflicts; retention and expiry must not permit duplicate in-flight orders.

## Lifecycle and publication

- Submission is not restaurant acceptance. Only authorized staff can accept a pending order.
- Valid transitions and expected order version are checked atomically.
- Persist status change, actor audit and outbound intent in the same transaction.
- Fulfillment, restaurant acknowledgement and payment state are distinct concepts.
- Historical orders/audit records are not deleted through restaurant/menu cascading deletes.
- Table QR URLs survive renames; a QR does not prove physical table presence.
- Publish menus/assets only after validation; failed processing never deletes a published original.
- AI output is an untrusted draft. Merchant approval precedes publishing images/text/translations.
- AI never supplies authoritative allergens, dietary safety, prices or order acceptance.

## Delivery and isolation

- Jobs carry tenant scope and schema version, resolve current permissions where applicable and
  deduplicate effects. Queue delivery may occur more than once.
- Side-effect completion has durable evidence and a reconciliation path after ambiguous failure.
- Cache keys and SSE channels include verified tenant/outlet scope; no private public-CDN cache.
- Missing AI, media or email must not prevent normal ordering.
