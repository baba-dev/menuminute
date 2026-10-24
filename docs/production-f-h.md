# Production work package F–H

This release adds reviewed menu localization, guarded commercial-finance completion and measured
recovery/reconciliation coverage. It does not include the AI Menu Assistant (E), and none of these
features are activated merely by deploying the code.

## F — reviewed multilingual menus

- An editor starts from the current immutable published menu and may change display strings only.
  IDs, prices, schedules, availability, dietary claims and media always come from the canonical
  release.
- Saving requires an explicit human-review confirmation and optimistic translation revision.
- A translation is public only while its `source_revision` exactly equals the menu's current
  `published_revision`. Draft edits do not invalidate guest text; publishing a changed source does.
- Guests may select only locales exposed by the public projection. Invalid or stale locale input
  falls back to the canonical menu. Translation history is append-only and tenant-scoped.

## G — commercial finance boundary

### Supported

- Stripe-hosted Checkout Session creation and partial refunds, both keyed by the durable internal
  attempt ID for safe provider retries.
- Raw-body webhook HMAC verification with a five-minute timestamp tolerance. Events validate the
  exact attempt, amount, currency and external identities, and concurrent duplicate delivery is
  idempotent.
- Provider-confirmed tenders are labelled `provider_confirmed`. Card/UPI/bank entries recorded by
  staff remain `staff_recorded`; the UI and data model never present those as gateway verification.
- Line-quantity partial credits use cumulative immutable line allocation, create a linked credit
  note, prevent over-refund and keep cash-drawer and provider movements separate.
- Private document email delivery records only keyed recipient evidence, never the address itself.

### Deliberate limits

- The only supported document policy is `non_registered_receipt_v1`. Generic registered invoices
  fail closed even when an operator gate is on. A separately reviewed jurisdiction adapter must
  own statutory invoice issuance, signatures, registrations and government reporting.
- Stripe, document issue and document delivery are each off by default. Runtime Stripe credentials
  do not open the database gate, and the database gate does not substitute for runtime credentials.
- Email delivery reports `uncertain` when the transport outcome is unknown. Operators must reconcile
  before retrying; the system does not claim exactly-once external email delivery.

## Activation and rollback

1. Keep `POS_STRIPE_ENABLED=false` through migration and deploy. Run the exact-SHA CI suite and an
   isolated restore rehearsal; migration `0022` is forward-only and must not be destructively
   rolled back.
2. Configure the server-only Stripe key and signing secret. Register the HTTPS endpoint
   `/api/webhooks/stripe/pos` and subscribe only to Checkout Session completion/expiry and refund
   lifecycle events used by the implementation.
3. On an internal non-fiscal outlet, enable `payments_enabled` and `provider_enabled` through the
   migration-owner/operator process. Enable `documents_enabled` only for the non-registered receipt
   policy. Enable `document_delivery_enabled` separately after mail transport verification.
4. Exercise duplicate clicks, lost browser response and refresh, delayed/duplicated webhooks,
   concurrent terminal confirmation, partial line credits and uncertain mail/provider outcomes.
5. Monitor the bounded Closing Desk reconciliation. Escalate
   `provider_attempt_needs_reconciliation`, `provider_capture_missing_tender`,
   `credit_document_missing` and `document_delivery_needs_reconciliation`; never initiate a second
   provider action to hide an uncertain first attempt.
6. To stop writes, close the relevant operator gates and runtime provider flag. Preserve all posted
   rows and historical read/print access; never delete financial evidence or reuse document serials.

## H — test and performance evidence

Mandatory CI covers formatting, lint, strict TypeScript, real PostgreSQL migrations/integration,
the production ARM64 build and Playwright. Focused contracts cover exact-revision locale fallback,
price-preserving translation projection, raw webhook tamper/age rejection, redirect allowlisting,
provider idempotency, concurrent confirmation, line refund bounds and fail-closed registered
documents. Existing ordering browser/integration coverage remains the source of truth for stale
price/modifier rejection, cart bounds, pickup timezone behavior and lost-response recovery.

Interactive finance reads and reconciliation remain bounded (500 recent bills); public translation
projection fetches only the requested locale and exact published revisions. Provider HTTP calls have
an eight-second abort and do not hold a database transaction open while waiting on Stripe.
