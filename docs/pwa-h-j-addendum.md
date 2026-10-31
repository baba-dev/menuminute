## Phase H — opt-in device alerts (source delivery)

The Web Push bridge is separate from the canonical Kitchen/Orders streams and from phases F–G.
`PWA_PUSH_ENABLED` defaults to **false** and requires an exact list of outlet IDs and
the reviewed VAPID P-256 key pair. The worker accepts only the locked-down public
push-service destinations and sends **no payload** at all. The service worker creates a
generic message locally and opens `/dashboard/orders` through normal authentication.

The database stores a hashed endpoint identity plus the endpoint URL and its server-owned
user/session/outlet scopes. Subscriptions are never trusted for tenant authorization.
The server derives outlet from the active authenticated workspace, checks the permission
and origin, and uses PostgreSQL SECURITY DEFINER commands. The outbox trigger records
delivery intent in the same transaction as canonical `order.created` or kitchen events.
The isolated worker leases notifications via restricted SQL procedures, rechecks active
session/membership/outlet roles, retries a bounded number of times, expires old requests,
and disables invalid or gone endpoints. A push service accepting a request is **not**
proof that the user saw the alert. The existing order inbox, reconciliation and expeditor
actions are the sole authoritative state.

## Phase I — installed-device controls

Visit `/dashboard/settings/device` using an authenticated outlet with `orders.read`
access. The page shows installed-app/worker/permission state, offers notification
categories, device-scoped subscription and removal, and clears only
`menuminute-pwa-*` public offline caches. A tap is always required before asking
the browser for notification permission. The browser subscription is shared across
outlets, so **Stop alerts** removes only this outlet's server subscription.
Session revocation, inactive organization/outlet, or lost order permission prevent
subsequent delivery. No background mutation is introduced.

## Phase J — release and device acceptance checklist

Source-level Vitest validates allowed push endpoints, ES256 VAPID JWT, zero-payload
HTTP delivery, default-off gate, worker event boundaries and security grants.
Browser acceptance covers unauthorized push endpoints, network-only POST requests,
unchanged offline cache behavior and worker registration.

Before **operator enablement**, complete and record all of the following on real
devices; GitHub CI by itself does not establish platform support:

- [ ] Android Chrome installed PWA: tap-to-opt-in, permission denial/recovery,
      foreground suppression, closed-app notification and authenticated click-through.
- [ ] iOS 16.4+ Safari **installed Home Screen** PWA (not Safari tab): permission
      prompt, alert, focus/deep-link behavior and sign-out/revocation.
- [ ] iPadOS installed PWA and desktop Chromium, plus Safari/Firefox capability
      variants: show accurate unsupported states rather than dead controls.
- [ ] Two sessions and two outlets: recipient isolation, station permission
      revocation, account switch, cross-tab settings, endpoint 404/410, alert TTL.
- [ ] PostgreSQL/Redis interruption, worker restart and repeated outbox events:
      no lost canonical order; no notification duplicates beyond documented
      push-service at-least-once behavior.
- [ ] Full exact-head native ARM64 CI, additive migration/backup verification,
      restricted-worker permissions, signed artifact and production/ERP health.
- [ ] Gradual opt-in outlet rollout approved by operator. Keep
      `PWA_PUSH_ENABLED=false` until validation and credentials are provisioned.

**Rollback:** disable `PWA_PUSH_ENABLED` in both web and worker environments,
restart services using the existing reviewed rollout procedure; leave the
additive tables and generic push handler in place. Do not delete the installed
service worker without the decommission release described above. Never interpret
push as payment verification, a confirmed order, or Kitchen completion.
