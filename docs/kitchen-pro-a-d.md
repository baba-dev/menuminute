# Kitchen Pro foundation (Phase 5, packages A–D)

> Implementation scope: PR #122. This is an **internal setup/review capability, not a commercial Kitchen Pro launch**. The previous /kitchen placeholder is replaced. Production readiness of the complete product remains gated by Phase 4 #37/#49/#50 and Phase 5 #76/#77.

## Canonical authority and contract

- The existing PR #79 PostgreSQL order is the only authoritative guest/merchant order ledger. PR #78's independent deterministic reducer remains a pure contract/unit-test reference. Do not introduce a second order state or a browser-sourced price.
- The additive `0013_kitchen_pro_foundation.sql` defines private outlet station settings, stations, member grants, dish routes, immutable item-to-station identity, mutable versioned work, a per-outlet ordered event counter and append-only kitchen events.
- All new tables enforce RLS and have no direct `menuminute_app` or `menuminute_worker` table privileges. Narrow SECURITY DEFINER functions use current actor/outlet/active membership and station assignment. Administrative setup requires `outlet.manage`, kitchen work `orders.prepare`, and full membership/station checks.
- An accepted order creates its configured station work in the **same PostgreSQL transaction** as the canonical order transition. A missing route blocks acceptance for an enabled kitchen rather than silently dropping an item. A unique (order_item_id, station_id) prevents duplicate fanout. A disabled kitchen leaves existing merchant ordering unchanged.
- Station Start/Complete require expected work versions. They do not update payment, guest order readiness or act as expeditor release. Merchant direct Ready is rejected if the order has station work. Cancellation/terminal transitions reconcile existing kitchen work and append change events.
- Per-outlet event sequence allocation locks the counter row until commit; an outbox event and kitchen event are committed together. The worker validates `kitchen.changed` from the persisted outbox with a distinct consumer receipt. The authoritative snapshot/cursor come from PostgreSQL, never from Redis. Pub/sub is not a ledger.
- Old migrations remain checksum immutable. This is an expand-only addition; application rollback cannot reverse committed SQL. Use the current helper v6 and independently verify candidate/live database migration compatibility and backups.

## Routes

All endpoints are private and scoped to `/api/organizations/:organizationId/outlets/:outletId/kitchen`:

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/` | GET | Authenticated snapshot of enabled state, eligible stations, admin-only routes/staff and station-visible work |
| `/changes?cursor=N` | GET | Bounded, ordered event metadata and resync indicator |
| `/stream` | GET | SSE immediate snapshot, authorized heartbeat and full snapshot after change/gap; session checked on every heartbeat |
| `/admin` | POST | Station create/rename, route assign/remove, member assign/remove and settings.disable |
| `/work` | POST | Version-checked Start/Complete, station scoped |

The stream is an optimization, not proof a command committed. Browser errors show uncertain state and reconcile using the GET snapshot. No offline replay of preparation actions. Status is never inferred from a sound notification.

## Initial UI

`/kitchen` uses the Ink & Ember theme and offers responsive station selection, queued/preparing/complete lanes, table/pickup context, full item variant/add-on/notes, elapsed time, explicit server-confirmed actions, network/last-sync status and optional user-controlled sound. Managers configure stations, dish routing and eligible teammate assignments in a dedicated setup section. A station member sees only their assigned work. Sound permission denial must not hide visual changes.

## Intentionally unshipped / hard gates

1. `kitchen_outlet_settings.enabled` **defaults false**. The public admin API expressly does not offer settings.enable. Even a manually issued `kitchen.new` entitlement cannot activate this partial release. Only an isolated migration-owner fixture can switch it on during testing.
2. PR E must deliver complete and approved expeditor release and merchant/guest transitions, route reassignment/cancellation policy and a reviewed enabled capability. PR F must harden failure/security paths; PR G full QA and load; PR H full operator rollout and handoff.
3. Existing Phase 4 auth/media/QR smoke, backup plus off-host alert, isolated matching SQL/media restore, independent visual/a11y approval and measured ERP coexistence remain external production sign-off gates.
4. Station scope, released menu identity across multiple menus/brands, routing updates to active orders, complete role-revocation/SSE/load evidence and 24-hour/overnight policy fixtures require independent review as applicable before commercial enablement. No imaginary tax or subscription policy is implied.
5. Current tests cover the pure reducer, restricted real PostgreSQL/two Redis integrations and the kitchen owner browser setup. A green CI alone is not full multi-device/operator acceptance.

## Validation and rollout

Run the existing exact-head four native ARM64 CI lanes (Prettier/lint; strict TypeScript; real PostgreSQL/two Redis; production build/Playwright) and aggregate gate. Review the resulting migration and actual app/worker compatibility, security and browser evidence independently. Do not merge a partial/failed CI branch: main automatically attempts release activation. Keep the Kitchen feature disabled until E–H have passed their respective gates.
