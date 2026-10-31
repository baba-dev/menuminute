# Progressive Web App contract

Implemented for issue #238. This is source behavior, not evidence of a production deployment or an
app-store release.

## Phase A — safety boundary

The service worker is deliberately an anonymous public-read cache, not a general application cache.
It handles same-origin `GET` requests only:

- network-first public pages and `/m/{publicMenuId}`;
- network-first `/api/public-menu/{token}` and `/api/public-media/{mediaId}` reads;
- cache-first immutable `/_next/static/`, `/brand/` and `/assets/` files, with bounded entry counts.

Everything else remains browser-default network-only behavior. In particular, the worker does not
intercept authenticated dashboards, context, orders, carts, checkout, kitchen, admin or assistant
APIs; non-GET requests; range requests; cross-origin requests; or responses varied by Cookie or
Authorization. There is no Background Sync listener and no mutation queue. An offline order cannot
be submitted or replayed.

Online `404` and `410` public responses evict all cached language/query variants for that pathname
and are returned directly. They are never replaced by stale data. Network failure can return a
previous public response, which the global offline notice labels as potentially stale.

## Phase B — install assets

`src/app/manifest.ts` owns the standalone manifest. Install PNGs are deterministic exports of the
approved `public/brand/icons/icon-master.svg`. The maskable and Apple icons use an opaque brand-orange
background; the maskable mark is inset inside the safe zone. The SVG favicon remains the browser-tab
asset and is not advertised as the install icon.

## Phase C — worker lifecycle

`public/sw.js` owns cache policy v1. The worker installs without taking over an existing worker, so an
update cannot discard an in-progress form. Activation deletes only older cache names beginning with
`menuminute-pwa-`; it never clears unrelated origin storage. The script is served with `no-store`,
`updateViaCache: "none"` and root scope so browsers check the current worker code.

Cache limits are 24 public documents, 80 public API/media responses and 96 static assets. Cache
Storage is an availability convenience, not an authorization source or durable record.

## Phase D — install, offline and update UX

The root layout mounts `PwaLifecycle`:

- Chromium-style `beforeinstallprompt` is exposed through an accessible optional prompt;
- iOS Safari receives Share → Add to Home Screen guidance;
- dismissal is remembered for 30 days;
- every route announces offline state and that live actions/ordering are unavailable;
- a waiting worker asks before reload, warning that unsaved form state may be lost.

The `/offline` route is precached as the last-resort document. Previously opened public menus can
render from cache; private routes and actions fail normally without connectivity.

## Phase E — evidence and rollback

`tests/pwa.test.ts` validates manifest/icon dimensions, worker headers, allow/deny routing, response
privacy and the absence of Background Sync. `tests/pwa-lifecycle.test.tsx` covers install and offline
UI. `tests/e2e/pwa.spec.ts` verifies the production manifest/worker and an offline browser where a
cached public menu works while private reads and POST mutations fail.

Rollback is two-step: first ship a replacement worker that unregisters itself and deletes only
`menuminute-pwa-*` caches, then remove registration code in a later release. Removing the script
without a decommission worker can strand the last installed worker in existing browsers. Database,
Redis, order, media-source and deployment migrations are not involved.
