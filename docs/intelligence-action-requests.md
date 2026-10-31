# Ember confirm-first actions (generic framework)

Status: **stage 1 of 3, not user-visible yet.** Stage 1 (this document's code) adds the storage,
SQL functions and server module. Stage 2 adds the model's propose-only tools, API routes and the
confirmation card. Stage 3 adds menu price/description kinds. `AI_ASSISTANT_ACTIONS_ENABLED`
remains the kill switch; nothing here runs until stage 2 exposes it.

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
