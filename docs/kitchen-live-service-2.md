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

Managers see every station in the _authorized outlet_, and can choose
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
channels. A connected station SSE does _not_ certify that incoming orders
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

## Terminology

The merchant-facing name for the "expeditor" step is **Final Check & Order Release**
(Indian eateries do not use the term expeditor). Code, SQL functions, permissions and
older docs keep the `expeditor`/`expo` identifiers; renaming them is out of scope. The
`/kitchen` page order is: hero with the "Every station in sight" panel, pulse KPIs,
preparation rail, then Final Check & Order Release. The Fast-Pass 86 panel was removed
from `/kitchen`; dish availability stays in the dashboard command palette.

## Per-item release (migration 0069)

Completed station items are released individually at Final Check:

- `kitchen_work.released_at/released_by` (nullable) mark a released dish; a CHECK allows it only on `complete` work.
- `app_private.kitchen_work_release(outlet, work, expected_version, key)` locks the order then the work row, is idempotent through `kitchen_command_receipts` (`work.release`), requires `orders.complete` and an owner/admin/`outlet.manage` actor, and moves the order to `ready` in the same transaction only when its last non-cancelled item is released. The order version is unchanged by intermediate releases.
- `kitchen_expo_release` ("release all") still requires every non-cancelled item to be complete; cancelled work no longer blocks or inflates counts. It marks remaining items released.
- Guests and the Orders desk see "Part ready" (`released of total`) via `guest_order_release_progress` (re-validates the tracking capability, returns counts only) and `kitchen_release_progress`. The order `status` enum is unchanged (still `preparing`).
- Rollback: the application can be rolled back without data repair; new columns are nullable and older code ignores them. SQL is append-only and is not rolled back.

## Ticket cards and allergen chips (migration 0070)

- **Layout** (`dish-details.tsx`, shared by the rail and Final Check): allergens first, then customisations (size/option chips labelled by group), then a large "Guest note" callout, then a separate "Whole-order note". Tickets with options, notes, an order note or declared allergens get a "Special request" cue and an accent edge. Every cue pairs an icon and text, so colour is never the only signal. The card also shows the intake source (POS, QR menu, Online).
- **Allergen data is only what the restaurant declared.** `order_items.dish_safety` is snapshotted by a `BEFORE INSERT` trigger from the outlet's published menu release (`safety.allergens`, `crossContact`, `verified`, and `dietary`), so it covers guest, POS and demo orders without changing those functions and reflects the menu at order time. Chips read "Contains … as listed by the restaurant", with "not verified" unless the profile is marked verified.
- **No inference.** A dish with no declared allergens shows no chip: absence is never "allergen free". Unknown allergen codes are ignored. Dietary tags are shown only as entered.
- **Safe failure.** The trigger swallows any error and leaves the column NULL; it can never block an order. Orders created before 0070 have no snapshot and show no chips (no backfill).
- Allergen data is advisory kitchen information, not a safety guarantee; staff must still follow the restaurant's allergen procedure.

## Motion layer (subtle, theme-aware)

Independent, dependency-free implementations inspired by [Magic UI](https://magicui.design) components (no Magic UI code or package was added; its licence was not reviewed because nothing was copied). Source: `src/app/kitchen/fx/*` and the "Motion layer" section of `kitchen.css`.

| Effect                 | Where                                                                                                           | Rule                                                                                                             |
| ---------------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Border beam            | Queued tickets unstarted 5+ min (amber), 10+ min (red, faster); Final Check orders with finished dishes waiting | At most 4 animate at once (`KITCHEN_BEAM_BUDGET`, oldest first); the rest keep a static ring. Paused off-screen. |
| Number ticker          | The four pulse KPIs                                                                                             | Screen readers get the final number only.                                                                        |
| Animated list          | New tickets ease in once                                                                                        | CSS only.                                                                                                        |
| Progress ring          | Hero station panel                                                                                              | Decorative; text states the numbers.                                                                             |
| Pulsating button       | Final Check release, intake Accept                                                                              | Stops when disabled.                                                                                             |
| Shimmer                | The oldest unstarted ticket's action                                                                            | One at a time.                                                                                                   |
| Blur fade, dot pattern | Hero, pulse and rail on first paint; hero background                                                            | First paint only.                                                                                                |

Not used on purpose: animated borders on allergen panels (safety information stays steady), confetti, meteors, particles and pointer effects. Every effect is static under `prefers-reduced-motion`, has light and dark tokens, and never carries meaning alone (the wait is also written as text).

## POS per-dish notes and "Part ready" (migration 0071)

- POS lines accept an optional `note` (trimmed, max 200). `app_private.pos_submit_order` stores it in `order_items.notes`, the column guest orders already use, so the kitchen ticket, Final Check, POS register and incoming-order views show it without further change. It never affects price, the catalogue fingerprint or the quote; a different note is a different request for idempotency. `pos_sale_lines`, receipts and finance documents are unchanged (kitchen instructions are not financial data).
- The till cart has "Add dish note" per line; empty notes are not sent. Identical dishes with different notes stay separate lines.
- The POS order register shows "Part ready · N of M dishes" next to the status (same `kitchen_release_progress` data and transaction as the register page) and in the order detail.

## Audit fixes (accessibility, resilience, time)

- **Screen readers:** a polite live region announces new tickets ("New ticket: 2 Paneer Tikka, order 1042" or "3 new tickets") and your own start/complete actions. Errors keep `role="alert"`. Heading levels no longer skip: the hero is the only `h1`, the outlet name is plain text, Final Check is an `h2` with `h3` order cards.
- **New-order cue without sound:** waiting tickets show in the browser tab title "(N)", new tickets glow once, and devices that support it vibrate briefly when sound is off.
- **Blocked bell:** if the browser refuses the bell until a tap, a banner says so with an "Enable sound" button (`isAudioSuspended` / `unlockAudio` in `lib/sound-effects.ts`).
- **Keep screen on:** `useWakeLock` holds a screen wake lock while the board is open (default on, toggle in the top bar, hidden where unsupported), re-acquires it when the tab returns, and reports what is really in effect.
- **Staleness:** the board warns when nothing (snapshot or heartbeat) has arrived for 45 s; the clock ticks every 10 s instead of 15 s.
- **Timezone:** "Last reconciled", Final Check times and the intake dock use the outlet's timezone (`formatClock`), not the device's.
- **Final Check resilience:** a transient refresh failure keeps the last known orders and warns; only 401/403 clears the list (done earlier with per-item release).
- Merchant Orders ticket options now show their group ("Spice: Mild"); station tabs have a 44 px minimum width.

Not done: centralising kitchen strings for translation (no i18n framework exists; a separate project), an automated axe scan in Playwright (needs a new dev dependency), and mobile access to the transfer panel.
