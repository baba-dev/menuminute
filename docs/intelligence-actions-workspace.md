# Ember C + D — confirmed actions and shared assistant drawer

Dependency: provider hub #155 and read-only orchestration #158. Follow-up of epic #152, work package #159. Both `AI_ASSISTANT_READ_ONLY_ENABLED` and `AI_ASSISTANT_ACTIONS_ENABLED` default to **false**; the action flag requires the read-only flag. Neither a merged PR nor a successful migration turns on the assistant.

## Exact action scope

Only `menu.availability.override` for one dish in one published menu assigned to the current outlet. No model-callable mutation tool exists: the human selects the precise menu/dish in an authenticated first-party composer and submits the proposal request. The fixed SQL procedure validates active actor, organization, outlet, conversation ownership and `menu.write`, current published release, current draft presence, current override state and immutable menu revision. The proposal snapshots visible before/after, menu and dish names, expires after 10 minutes and is private under forced RLS. Model text, user prompt and imported documents do not become SQL or action arguments.

A separate same-origin authenticated POST is required to **confirm** or **reject**. Confirmation rechecks current role, outlet, menu assignment, `menu.write`, revision, current published dish and effective availability. A role revocation or expired proposal fails closed. A stale menu records a terminal `stale` receipt, never a false success. The existing `app_private.menu_command('override')` is invoked with a stable `ember:<proposal-uuid>` request key, inside the same transaction as settling the proposal; it retains the previously configured outlet-specific price. Repeated confirmation with the same decision key returns the original receipt without executing again. Different decision keys and attempts to confirm after rejection conflict. No automatic publish, refund, order cancellation or security/billing changes. Operator direct domain paths remain unchanged.

## Shared workspace UX

The authenticated workspace mounts Ember only when the read-only flag is enabled and an authorized outlet is selected. Floating launcher, responsive drawer/mobile full screen, focus trap and restoration, Escape and backdrop dismissal, keyboard form submission, reduced motion and Ink & Ember contrast. The drawer exposes per-outlet durable conversation history, bounded server-provided answer/source labels and explicitly clicked navigation cards from a static allowlist. No model-authored URL, arbitrary pathname, or cross-outlet navigation is used. Any network-uncertain send surfaces a warning and reloads durable history; it never automatically reissues a billable turn. A separate availability editor renders only published/assigned menus and an explicit checkbox to acknowledge before confirmation. Pending, stale, rejected, expired and confirmed states remain distinguishable across reloads.

## API

- `GET /api/assistant/capabilities?organizationId=...&outletId=...`: scoped flags, permitted tool names, static route IDs.
- `GET /api/assistant/availability?organizationId=...&outletId=...`: bounded published editable menu/dish options; action-gated.
- `POST /api/assistant/actions`: UUID request key, explicit conversation/menu/dish/desired state; creates the preview, **does not change the menu**.
- `POST /api/assistant/actions/[proposalId]`: UUID decision key and `confirm` or `reject`.
- `GET /api/assistant/conversations/[conversationId]/actions`: latest 20 proposals, scope and permission checked.

All writes reuse `requestActor(req,true)`, Zod strict bodies and actual 6 KB bounded payloads. All results use private/no-store; no browser-only authorization. SQL functions have explicit EXECUTE grants, default PUBLIC/worker denied, and the underlying action table grants only actor-scoped SELECT to the web role. Release requires exact-head ARM64 CI, independent security/integration review, commercial provider licensing, retention/data processing sign-off and separate activation authorization.
