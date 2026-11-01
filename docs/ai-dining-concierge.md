# AI Dining Concierge 1.0 — global restaurant rollout

Guest-facing meal discovery on the existing public QR menu. Concierge does not create menus, change dish prices, bypass dish customization, submit orders, or run Ember tools.

## Enable for every published restaurant

The release adds an explicit operator switch: `AI_DINING_CONCIERGE_ALL_OUTLETS`. When both this and `AI_DINING_CONCIERGE_ENABLED` are true, the guest entry is available for **all existing and future restaurant outlets with a valid, published public menu**, without maintaining an outlet allowlist. Unpublished menus, revoked QR tokens, suspended or otherwise inaccessible outlets, and merchant preview screens remain unavailable under the existing public menu contract. A global rollout does not enable online ordering, payment collection, or Kitchen Pro.

On the VPS, update the root-only web runtime file `/etc/menuminute/web.env` (not `.env.example`, `worker.env`, or a committed file) after confirming the NVIDIA commercial entitlement, approved model, and provider-side spending limit:

```ini
AI_FEATURES_ENABLED=true
AI_NVIDIA_ENABLED=true
AI_NVIDIA_COMMERCIAL_APPROVED=true
NVIDIA_API_KEY=<private existing value>
AI_NVIDIA_MODEL=nvidia/nemotron-3.5-super-vl-120b-a12b
AI_DINING_CONCIERGE_ENABLED=true
AI_DINING_CONCIERGE_ALL_OUTLETS=true
AI_DINING_CONCIERGE_OUTLET_IDS=
```

The NVIDIA model above is an **example**, not a required replacement for an independently verified text/JSON-capable model. Do not paste production API keys into tickets, logs, GitHub, or screenshots. Global mode is intentionally off until the operator explicitly sets it to `true` and deploys this code. Setting `AI_DINING_CONCIERGE_OUTLET_IDS=*` does not mean "all outlets" and will fail validation.

- **Global mode:** both `AI_DINING_CONCIERGE_ENABLED=true` and `AI_DINING_CONCIERGE_ALL_OUTLETS=true`; the exact-ID list is ignored.
- **Pilot / allowlist mode:** `AI_DINING_CONCIERGE_ALL_OUTLETS=false`, `AI_DINING_CONCIERGE_ENABLED=true`, and `AI_DINING_CONCIERGE_OUTLET_IDS` set to comma-separated exact IDs (at most 50).
- **Immediate kill switch:** `AI_DINING_CONCIERGE_ENABLED=false` disables every outlet, even if `AI_DINING_CONCIERGE_ALL_OUTLETS=true` is still present. The service may boot safely in this disabled state, even when provider credentials are unavailable.

When global mode is active, invalid or missing NVIDIA master/provider configuration **fails startup** with `Invalid configuration: AI_DINING_CONCIERGE_ALL_OUTLETS` rather than showing a broken selector. This is separate from Ember's read-only tool and pricing flags; it calls NVIDIA only in text/JSON mode, never Cloudflare.

## Release and restart

Merge only after exact-head CI, unit tests, production build, and a public-menu browser acceptance check. This is a code/config update with **no database migration**. Release through MenuMinute's existing verified CI / ARM64 activation path; a systemd restart alone cannot deploy the new global-mode code.

After the approved release is active, update the web env and restart **only the web service** to load it. The worker does not serve the public Concierge endpoint:

```bash
sudoedit /etc/menuminute/web.env
sudo systemctl restart menuminute-web.service
systemctl is-active menuminute-web.service menuminute-worker.service
curl -fsS --max-time 15 http://127.0.0.1:3100/api/health/ready
curl -fsS --max-time 20 https://food.bababuilds.com/api/health/ready
```

Verify from a fresh browser session on a real published restaurant menu (for example `/m/<valid-public-token>`). Concierge should appear **above classic search** on both desktop and mobile; choose preferences, request meals, and try adding to cart. Confirm a newly created outlet with its own published menu also sees the entry, but an unissued or revoked token does not. With online ordering disabled, diners may still explore and view meals without a checkout action. Confirm that the existing cart, item variants, required add-ons, taxes, and Kitchen Pro flows remain unchanged.

The menu payload is re-evaluated against the runtime gate on both Redis cache hits and database reads, so activation and rollback do not require flushing Redis or publishing a new menu.

## Abuse, spending, and safety

- The public endpoint requires a verified proxy-attested client identity and a non-revoked menu token. It uses an atomic Redis limiter of 8 attempts per source/token/hour, 240 per outlet/hour, and **2,000 globally/hour**. Redis failure returns 503 before inference. These are request limits, **not a monetary spending cap**.
- **Before global activation, set an independent spending/billing limit with NVIDIA**, and monitor inference usage and failed responses. With global exposure, hourly rate limiting alone does not cap daily cost. Review whether the provider and the deployment have enough capacity for all outlets.
- Guest prompts and menu text are untrusted. Published status, outlet scope, sold-out/availability schedules, verified free-from flags, and guest budgets are validated before AI sees candidates. Only verified published dish IDs, prices, and safe combinations may be returned. Deterministic curated results are shown if NVIDIA cannot return a trustworthy selection.
- The guest must use existing item customization for required choices. Cancelling that process adds no partial meal; payment and guest order authorization remain on the existing routes.
- Never describe unknown ingredients as allergen-safe. Restaurant staff must confirm allergens and cross-contact.

## Acceptance and rollback checklist

1. CI: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, plus source-level global/allowlist/kill-switch regression tests.
2. Browser: check desktop/mobile, keyboard navigation, dark mode, reduced motion, each wizard step, menu search, real published item customization, and ordering/no-ordering modes.
3. Failure states: invalid/unpublished/revoked public token, provider timeout, malformed NVIDIA response, Redis failure/429, availability/price changes, and valid menu cache hit/miss.
4. Monitor `journalctl -u menuminute-web --no-pager -n 80` (never print secrets); compare provider usage against the pre-approved budget.
5. Rollback by changing `AI_DINING_CONCIERGE_ALL_OUTLETS=false` to restore the exact outlet allowlist, or set `AI_DINING_CONCIERGE_ENABLED=false` to disable entirely; then restart `menuminute-web.service`. No migration rollback or worker restart is required.

Merchant self-service activation, discounts, guaranteed allergen-free meals, saved guest profiles, and structured course-role editing remain outside this release.
