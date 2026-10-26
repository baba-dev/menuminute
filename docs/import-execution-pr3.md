# PR 3 — Fenced AI Menu Import and Worker-Lane Isolation

## Problem and threat model

The source audit identified a 60-second durable outbox redispatch for potentially 12 sequential NVIDIA calls, each allowed up to 45 seconds. A second delivery could prematurely label a valid running import `ambiguous_delivery` and reject its result. AI jobs also occupied one of two domain worker slots shared with orders, media and kitchen notifications. Provider calls can be billed even if the response is lost: **we cannot guarantee safe automatic replay after a crash**.

## Architecture

- The existing worker systemd service owns **two BullMQ queues**: `menuminute-domain-v1` (domain/media concurrency 2) and `menuminute-domain-v1-ai-v1` (import concurrency 1). The dispatcher routes jobs by their persisted PostgreSQL event type, not untrusted queue job names; the import lane rejects non-import events. An old import job left in the domain queue is ignored, then republished from its unchanged durable outbox record to the import queue. Domain jobs never wait for an active AI provider job's BullMQ slot.
- Migration `0027_import_execution_leases.sql` introduces an opaque internal execution fence and a database heartbeat on `menu_import_ai_usage`. Every 15 seconds, the restricted worker renews the fence and pushes the outbox due time 120 seconds ahead. The lock ordering follows outbox -> import/usage where needed. A duplicate delivery while the heartbeat is fresh returns `{done:true,active:true}` and NEVER calls NVIDIA twice.
- If heartbeat freshness exceeds 120 seconds, a later delivery finishes the previous attempt as `unknown/ambiguous_delivery` and records a scoped audit entry. A late result cannot modify a completed event. No provider request is automatically retried. A new import still requires a deliberate user action.
- The provider loop checks the fence *before* each page and immediately before making a provider request. If the worker loses its lease, it cannot submit another potentially billable page. Request and token usage continue to use the existing provider accounting. The final result is committed only when the execution fence is valid. A failed DB heartbeat or provider error does not leak provider input or credentials.
- Existing manual import release/commercial approvals, 20/day org limit, 12-page cap, explicit provider consent, private source storage, read-only candidate, no auto-publish, RLS/worker restrictions, cancellation and financial guarantees are retained.
- Two queues still share one Node worker process/limited PostgreSQL pool; **BullMQ concurrency isolation is not complete CPU/memory process isolation**. Run a dedicated AI OS process in a later capacity scale-up if the host requires it. Never claim that this change eliminates sharp memory pressure.

## Migration and deployment

- Forward-only **0027**. No applied migration is modified. Keep existing `menuminute-worker.service`, `dist/worker.mjs` and the atomic package/cutover structure. The second Redis queue is created lazily by BullMQ; no new Redis port, credentials or VPS service is required.
- Existing `started` usage rows from older workers have no fence; a later delivery safely classifies them as unknown, not as a billable automatic retry. Stop the existing worker at the scheduled release cutover; account for interrupted in-flight AI provider calls. Roll back to a worker compatible with the newly applied fenced receipt only after operator assessment; **do not revert or edit the applied SQL**.
- Restricted `menuminute_worker` receives only EXECUTE for `import_engine_heartbeat`, not direct imports/candidate UPDATE privileges. SQL definition uses a fixed search path and events/usage are scoped by event and organization.
- The 120-second retry delay is not a provider call timeout; up to 12 pages may run well beyond two minutes. Each fresh heartbeat extends the due time. Queue loss and outbox dispatcher restart recover from PostgreSQL.
- Rehearse 12-page extraction using a stubbed provider with 45-second simulated latency. Confirm a provider request is not duplicated while heartbeats succeed and no order/kitchen event is delayed behind the import. Confirm one worker SIGTERM during a provider request becomes unknown after lease expiry, not an automatic reissue.

## Verification / operational release gates

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, PostgreSQL+Redis integration, ARM64 build/Playwright, and the aggregate quality gate on **the final PR head SHA**. Confirm `0027` appears after `0026`; production migration backup/restore rehearsal and release helper safety checks must remain intact. Verify `dist/worker.mjs` contains both worker queues, the isolated queue's BullMQ job ages, worker resident memory under the 256 MiB systemd limit, and database pool exhaustion behavior. Confirm unchanged ERP health.

**PR 3 does not solve stale import-source file cleanup or the permanent 30-source outlet storage cap (I-2), menu draft merge (I-5), or public cache/media optimizations (I-8); these require their separate remediation slices.**

Source PRs do not prove server activation or live NVIDIA billing behavior. No production NVIDIA calls should be made from CI or the PR.
