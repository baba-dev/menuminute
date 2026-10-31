# Ember confirm-first actions (generic framework)

Status: **all three stages implemented.** Stage 1: storage, SQL functions and the server module
(`action-requests.ts`). Stage 2: propose-only model tools (`propose-tools.ts`), the list/decide API
routes and the confirmation card (`ember-action-card.tsx`). Stage 3 adds menu price/description
draft edits and a confirmed publish (below). `AI_ASSISTANT_ACTIONS_ENABLED` is the kill switch: with it
off, no propose tool is advertised or executable and the routes refuse.

## What people see

Ask "accept order 12", "mark table 5's water request as seen" or "start the paneer for order 12".
Ember replies in one short line and shows a quiet card with the exact change, **Confirm** and
**Not now**, and a hairline that drains over the request's 10 minutes. Nothing changes before
Confirm. Afterwards the card settles into a one-line receipt; "Not now" and expired cards simply
disappear. Motion is a short entrance, the hairline, a drawn tick and soft thinking dots, all off
under `prefers-reduced-motion`.

## Propose-only tools

`propose.guestRequest`, `propose.orderStatus`, `propose.kitchenTicket` and `propose.supportTicket`
(see `support-desk.md`) take human references
(table, order number, dish), resolve the real record on the server, check the next step is allowed
(for orders: pending→accepted|rejected, accepted→preparing|cancelled, preparing→ready|cancelled,
ready→cancelled|served (dine-in)|collected (pickup); kitchen-run orders are left to the kitchen) and
store a pending request with a server-built summary. Ambiguity ("table 5 has two requests") is
returned as a question, never guessed. Tools are advertised only when actions are enabled **and** the
person holds a matching permission.

## Rules

- The model may only **propose**. Proposing writes a pending row (`assistant_action_requests`)
  with a server-built plain-language summary; it changes no business data.
- Only the **same signed-in person** can confirm, within 10 minutes, and only while their role
  currently allows the action (checked when proposing, when confirming, and again by the domain
  command itself).
- Confirming runs the **existing domain command** (service-request action, order transition,
  kitchen work command). Those keep their own authorization, state machine, optimistic version
  and outbox. This module never writes business tables.
- Payments, refunds, billing, staff access and menu publication are **excluded**.

## Lifecycle

`pending → confirming → confirmed | stale | failed`, or `pending → rejected`.

1. `ai_propose_action` — idempotent on `(user, outlet, request_key)`; limits: 60 previews/24 h per
   person, 5 pending per conversation; conflicting replay of a key is refused.
2. `ai_claim_action` — row-locked claim `pending → confirming` (a double click cannot run twice).
   Replaying the same key while `confirming` returns the stored params (crash retry); once
   finished it returns the stored receipt.
3. Domain command runs **outside** any open database transaction. Kitchen work uses the request id
   as its idempotency key; orders and service requests rely on their own version/state checks, and
   a conflict is recorded as `stale` ("it changed before you confirmed, nothing was changed").
4. `ai_finish_action` — records the outcome; only the claimant's key can finish.

Failure copy shown to people is fixed plain language; raw database or provider text is never stored
in the receipt.

## Operations notes

- Migration `0065` is additive. Rollback: stop proposing (kill switch), then drop the table in a
  later forward migration; no business data is stored here.
- Rows cascade-delete with their conversation, so the public-demo reset keeps working;
  `tests/demo-reset.test.ts` lists the table under `PRESERVED` for that reason.
- Like `0064`, the table has an owner-only policy because the functions are `SECURITY DEFINER`
  and the production migration owner is a plain role (`tests/intelligence-definer-rls.test.ts`).

## Menu changes and publishing (stage 3)

- `propose.menuPrice` and `propose.menuDescription` prepare a change to one dish in the **draft** menu.
  Confirming saves the draft through the existing `menu_command` `save` (permission, revision check,
  idempotency key = request id). **Guests do not see it until the menu is published**; the card and the
  receipt say so. Refused up front (asked back in plain words): unknown or ambiguous dish, unchanged
  value, dishes with size options or a local outlet price (change those in Menu Studio), a price that
  jumps more than 3× either way unless the person clearly confirmed it, and any new allergen,
  dietary or nutrition wording (never written by Ember; checked again at confirm).
- `propose.menuPublish` prepares publishing the draft. It is only offered when
  `AI_ASSISTANT_PUBLISH_ENABLED=true` (a separate switch that requires the actions switch), only on an
  explicit "publish / make it live" request, and not while a draft edit card is still waiting. The
  card is labelled **Publish** and lists what will change (price, description, new or removed dishes,
  sold-out state; first publishes state the dish count). Confirming runs `menu_command` `publish` with
  the revision seen when prepared, so if anyone edited the draft in between, nothing is published and
  the person is told to ask again.
- This is **human-confirmed publishing**, not autonomous AI publishing: every publish is one explicit
  confirmation of an exact, previewed change by the same signed-in person with `menu.write`.
- Migration `0067` only widens the request-kind check to add `menu.publish`.
