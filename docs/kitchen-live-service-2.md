# Kitchen Pro 2.0 — live service operating procedure

## Purpose
This release separates **merchant order administration** from **Kitchen Pro preparation**
without hiding either workspace. Owner/managers can visit `/dashboard/orders` for
payments, order history, handoff, and commercial questions while `/kitchen`
is the operational preparation desk. No forced redirect is permitted.

## Ticket lifecycle
1. A new Till/QR/online order is stored as `pending`. A server-reconciled
   Kitchen attention dock shows the oldest pending order, an actionable
   Accept & route control, and a durable inbox for the remaining pending orders.
2. The authorized intake command changes `pending → accepted` and creates
   each routed station work ticket exactly once in the same DB transaction.
   A retry requires the current version; if the outcome is uncertain, synchronize.
3. The first authorized station `start` changes its station task to `preparing`
   and atomically changes the canonical order `accepted → preparing`, with
   an outbox event and order-status audit. Other assigned stations may start
   independently, without duplicated order transitions.
4. Station `complete` changes only that station's work state.
5. Expeditor sees full order progress across the authorized station view.
   **Only when all station work is complete** may an actor with
   `orders.complete` release the order to the guest-facing `ready` state.
6. The merchant Orders desk retains the post-release `served`/`collected`
   and money recording functions.

### Recovery of older stranded orders
Prior releases permitted work `complete` while the parent order stayed
`accepted`. The new expeditor release transaction may reconcile one such
order `accepted → preparing → ready` only if:
- the actor has current expeditor permission, outlet/session context, and active kitchen access;
- the request holds the order lock and submits the exact canonical order version;
- the outlet remains enabled;
- at least one station work record exists and **all** are `complete`;
- the usual idempotency receipt, event, outbox and audit safeguards apply.

Never mass-edit order statuses with SQL in production. Use the authorized
expeditor UI/API, record any remaining anomaly and investigate before retrying.

## Service visibility
Managers see every station in the *authorized outlet*, and can choose
**All Stations** or a specific station. The station count and age data come
only from `kitchen_snapshot` already filtered under PostgreSQL authorization.
Station workers see only their assigned stations, not arbitrary tenant or
unassigned station details. These counters represent station work only;
pending order counts belong to the separately synchronized intake feed.

The incoming-order dock is fixed and actionable on screen. The inbox retains
pending items across page refresh, station changes and reconnections because
the database feed, not a client toast, is authoritative. The audible cue is an
optional local device preference; first hydration is quiet, and an order that
appears in later refreshes sounds once per page session. Browser audio may
require an explicit user gesture. Sound is not a delivery guarantee.

The Kitchen stream and the merchant pending-order poll are separate health
channels. A connected station SSE does *not* certify that incoming orders
were synchronized. The dock displays its own error and blocks stale actions.

## Operational QA / rollout checklist
- Run all required CI, isolated migration validation, and ARM64 browser checks.
- Test Till → Pending → Accept → two stations → Start/Complete → Expeditor
  release → Ready → Served/Collected, with both QR guest and Till sources.
- Test stale version, two concurrent acceptors, retry/idempotency, permission
  revocation while a command is outstanding, read-only reconnect, SSE overflow,
  merchant board navigation and transaction audit/outbox.
- Test historical accepted + complete recovery via expeditor, with an incorrect
  version first. Confirm no guest Ready before all work is complete.
- Exercise owner All Stations versus restricted assigned-only kitchen staff.
- Test 360/390/768/1024/1440px, keyboard traversal, screen-reader announcement,
  audio unlocking, preferred reduced motion and touch fullscreen.
- Verify off-host backup and isolated restore, rollback plan and cross-service
  CPU/memory/database/Redis metrics before production release.

No deployment or commercial entitlement is automatically changed by this PR.
