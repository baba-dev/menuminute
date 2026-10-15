# Order reliability contract

Status: required for the ordering implementation; current routes are previews.

## Submission transaction

1. Resolve public menu/QR capability to an active organization/brand/outlet and fulfillment mode; enforce opening/order policy,
   entitlement, payload/rate limits and service-point binding where dine-in requires it. Require staff acceptance at launch.
2. Validate a client-generated submission key scoped to the restaurant/outlet and guest session.
   Use a database uniqueness constraint and canonical request hash, including options/quantities.
3. Revalidate current menu version, prices and availability. Changed totals require fresh customer
   confirmation; do not reserve an irreversible idempotency result for a rejected stale quote.
4. In a short PostgreSQL transaction allocate the display number safely, insert order/item snapshots,
   initial status event and outbox event, and persist the idempotent result.
5. Reply only after commit. If the response is lost, retry with the same key or query a scoped
   submission-status endpoint. Concurrent duplicate requests converge on the same result.

Do not generate numbers with an unlocked MAX+1. Display numbers are outlet/business-date scoped
and distinct from opaque order IDs. Business date uses outlet timezone, not the server timezone.

## Fulfillment and payment

Target fulfillment: pending -> accepted -> preparing -> ready -> served (dine-in) or collected (pickup).
Pending -> rejected/cancelled/expired; accepted -> cancelled only under an explicit role/policy.
Later cancellation requires a defined compensation and audit workflow; terminal states do not regress.
The current scaffold uses confirmed/delivered: map these names explicitly during migration.

Use expected version and valid prior status in the update predicate. Append actor/reason/event and
increment version atomically; stale callers receive conflict and refresh. Pay-at-restaurant records
use separate unpaid/paid/voided states with authorized audit; no diner payment-provider integration at launch.

## Outbox -> BullMQ -> effect

Outbox records include event ID, tenant/outlet, aggregate/version, event schema version, timestamps,
lease/attempt fields and destination. Dispatchers claim batches with finite leases; never hold a
business transaction open while calling Redis. Deterministic queue IDs must follow BullMQ's ID rules.
An enqueue acknowledgement is not effect completion.

A crash after enqueue but before marking dispatched can cause duplicate enqueue. Keep durable
consumer receipts/work status keyed by event+consumer; queue job-ID deduplication alone is insufficient
after job cleanup. Reconcile dispatched-but-incomplete work after a deadline, including Redis flush/loss.
Apply jittered backoff, bounded retries, failure classification and an operator-visible failed-work list.

An external email/API effect cannot be made atomic with a database receipt. Use the provider's
idempotency support and reconcile ambiguous outcomes; do not promise exactly-once side effects.

## Kitchen delivery and recovery

Persist an ordered per-outlet event cursor with commit-order-safe allocation (see architecture).
SSE emits identifiers and minimal authorized data. Reconnect replays or fetches a consistent snapshot
plus watermark, then catches up from that watermark. Define bounded retention and full resync for old
cursors. Poll periodically to reconcile open orders even when live delivery appears healthy.

Surface pending acceptance age, connectivity and last successful sync. Escalate unacknowledged orders
via a defined operator workflow; email success and audible chimes are not acknowledgement.

## Required failure evidence

Duplicate tap; concurrent same/different payload keys; commit followed by lost response; concurrent
staff transitions; worker crash before/after effect; lost Redis data after dispatch; SSE reconnect;
expired cursor; price change; revoked staff access; wrong-outlet capability; database failure before
commit. Validate invariants with the actual production database engine.

## Closing, repeated orders and permanent QR

Follow [product requirements](product-requirements.md): new/additional orders create separate tickets;
submitted-order editing is deferred. Pending orders snapshot the outlet service-session closing
instant in its IANA timezone, including overnight hours. Organization schedules are defaults, not
one global expiry timestamp. Specify a cutoff for 24-hour service. Compare database time and stored
deadline during acceptance and expiry using atomic expected-state/version updates. Recover missed
expiry jobs after restart and reject overdue acceptance even if the worker is unavailable. Accepted
work continues after closing. QR identity survives guest-session expiry; only explicit organization
administrator deletion/regeneration revokes a printed token (suspension may disable access).

Pickup follows preparation -> ready -> collected; diner payment remains separate. Customer contact,
ASAP/scheduled pickup and missed-collection rules must be resolved in UX acceptance. Do not assume
a table is required for pickup or a phone is required for dine-in.
