# PR B — Ember read-only orchestration

Epic #152 / work package #156. Dependency: merged provider PR #155. **Not production activated.**
The server controls the entire tool registry, access scope, provider selection and response data.
No SQL, external URL, finance write, menu mutation, navigation instruction or shell tool is model-accessible.

## First-party API

- POST /api/assistant/conversations: organizationId, outletId, UUID key; creates a durable scoped conversation with idempotent replay.
- GET /api/assistant/conversations?organizationId=...&outletId=...: last 20 of the current authenticated actor's conversations.
- GET /api/assistant/conversations/[conversationId]?organizationId=...&outletId=...: 50 latest turns, reversed into chronological order.
- POST /api/assistant/conversations/[conversationId]/turns: organizationId, outletId, UUID key, prompt (1–4000 characters). Existing key replays status/result without another provider request. A processing request yields HTTP 202. Statuses: processing, completed, failed. A failed/uncertain request must use a NEW idempotency key; never blind-retry billable inference. An interrupted processing receipt older than 120 seconds becomes terminal `interrupted` on the next turn submission; the same original key replays that failure, never the provider request.

All POST handlers require same-origin authenticated JSON, MFA enrollment policy and a 6 KB body limit. Scope comes from server-authenticated actor plus explicitly authorized org+outlet, **not a demo/default outlet**. Session membership is rechecked in SQL and domain tools. Responses use private/no-store. No public/guest endpoint. No browser UI until PR D. No SSE in PR B; the normalized result contract supports future streaming separately.

## Tool contract and truthful outcomes

Bounded tools: orders.pulse, orders.history, kitchen.pulse, menu.summary. The model-visible tools are filtered by freshly checked `menu.read` and `orders.read` permissions before inference. Calls additionally reuse existing domain authorization and return narrow snapshots stripped of customer phone, notes and names. Order totals are NOT collected revenue. Draft menus are NOT live publication state. Kitchen metrics are the currently visible work only and surface overflow. Each evidence item has server source and capturedAt. Model output is always accompanied by the actual evidence in the response. No-tool or malformed first response fails, never hallucinates business facts.

## Durable accounting and failure semantics

Migration 0021 follows the merged checkout migration 0020 in the append-only journal creates composite-scoped PostgreSQL conversation, turn and attempt records, RLS forced on every table and explicitly denied worker/public access. Transactions establish app.actor_id/app.outlet_id locally and require active current permission (menu.read or orders.read). User idempotency keys and one in-progress turn per conversation serialize duplicate clicks; private atomic counters bound 12 conversations/actor/UTC day and 20 turns/actor/UTC day across outlets. Each organization has an atomic, private 80-attempt cap per UTC calendar day; each turn is restricted to two unique rounds. Every provider request is recorded BEFORE leaving the server. Uncertain attempts are retained; no automatic retry or paid fallback. Provider-reported token counts are stored only when present. This is an operational cap, not financial billing or guessed inference cost. Add provider/account-based spend budgets and retention operator before commercial enablement.

## Deployment and gates

Add AI_ASSISTANT_READ_ONLY_ENABLED=false to runtime config, independent of the existing default-off AI master/provider flags. Activation requires an approved verified tools-capable model. Never enable production based only on a green PR. Requirements: migration 0020/0021 reconciliation, exact final-head four ARM64 CI lanes + aggregate, independent security/integration review, entitled commercial keys, privacy/retention approval and separate production release evidence. No live model call in CI. Application ordering, POS and kitchen remain usable during AI outages.

## Product knowledge (Help Center)

Ember answers "how do I…" and product questions (plans, commission, Kitchen Pro, offline use) from
the published Help Center only: `help.search` returns the best owner guides (diner-only guides are
excluded) plus up to two matching Help Center FAQ answers, and the reply links to the illustrated
guide. Nothing under `docs/` is exposed to the model: those files contain operations, hosting and
security detail. Adding a new topic means adding a Help Center article or FAQ in `src/content/help`.
If no guide matches, Ember says so and links to the guides; it must not invent product features.
Greetings, thanks and "what can you do?" are answered without a model call from the person's
authorized tools (`small-talk.ts`).
