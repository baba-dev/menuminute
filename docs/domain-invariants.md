# Domain invariants

Target requirements. These are not assertions that the scaffold already satisfies them.

## Identity and tenancy

- Every private operation requires current session, organization membership and assigned brand/outlet scope.
- Brand/outlet/menu assignments stay in one organization; composed roles never exceed granted scope.
- The creator is Owner with all operational permissions; delegated staff may accept orders.
- A client-provided restaurant/outlet ID is a selector, never proof of access.
- Cross-tenant relationships are rejected by composite foreign keys and service checks.
- Demo/default restaurant lookup is permitted only on explicitly public demo routes.
- Suspension and staff removal take effect for requests, jobs and live subscriptions.
- Guest order/read capabilities are opaque, scoped and limited; no sequential order-ID access.

## Money and order data

- Store amount in integer minor units plus ISO currency. Respect currency exponent (INR 2, OMR 3).
- USD/INR limit platform subscription billing only. Outlets select any supported local currency;
  historical currency/amounts are immutable and reporting never silently sums different currencies.
- Use checked integer/BigInt or decimal arithmetic at calculation boundaries; specify rounding order
  for discounts/tax. Serialize large integers safely; never assume all BIGINT values fit JS Number.
- Server prices, options, availability and entitlements are authoritative.
- Save names, variant/options, prices, taxes and totals as immutable order snapshots.
- Quantities are positive whole numbers with no merchant-facing maximum cap. Enforce numeric
  representability, checked arithmetic and request-size/rate protections; reject negative totals.
- One scoped idempotency key maps to one canonical request hash and order result. Reuse with a
  different payload conflicts; retention and expiry must not permit duplicate in-flight orders.

## Lifecycle and publication

- Submission is not restaurant acceptance. Only authorized staff can accept a pending order.
- Valid transitions and expected order version are checked atomically.
- Persist status change, actor audit and outbound intent in the same transaction.
- Fulfillment, restaurant acknowledgement and payment state are distinct concepts.
- Historical orders/audit records are not deleted through restaurant/menu cascading deletes.
- QR URLs survive renames, type/menu/plan changes until explicit administrator deletion/regeneration.
  Temporary guest-session expiry never rotates printed QR identity; QR is not physical-presence proof.
- Repeat submissions with new keys create separate tickets; submitted orders are not edited in V1.
- Dine-in ends served; pickup ends collected. Neither implies payment.
- Pending expiry uses the stored outlet-local service-session closing instant. Acceptance/expiry
  compete atomically; accepted work continues after closing.
- Publish menus/assets only after validation; failed processing never deletes a published original.
- AI output is an untrusted draft. Merchant approval precedes publishing images/text/translations.
- AI never supplies authoritative allergens, dietary safety, prices or order acceptance.

## Delivery and isolation

- Jobs carry tenant scope and schema version, resolve current permissions where applicable and
  deduplicate effects. Queue delivery may occur more than once.
- Side-effect completion has durable evidence and a reconciliation path after ambiguous failure.
- Cache keys and SSE channels include verified tenant/outlet scope; no private public-CDN cache.
- Missing AI, media or email must not prevent normal ordering.
