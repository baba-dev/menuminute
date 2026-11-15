# Search indexing (SEO)

Status: implemented in code; Search Console verification and submission are operator steps and
have **not** been done.

- `src/app/robots.ts` → `/robots.txt`: crawlable marketing, help, docs and `/m/` public menus. Blocks
  API, admin, dashboard, kitchen, account, auth flows, `/home-v2` and guest order tracking
  (`/m/*/orders/`). robots.txt controls crawling only; private pages also set `robots: { index: false }`.
- `src/app/sitemap.ts` → `/sitemap.xml` (dynamic): static marketing pages, feature and solution pages,
  help and docs articles, plus **every published store menu** (`/m/<token>`), read through
  `app_private.public_menu_sitemap()` (migration 0112, read-only, token + timestamps only). The gate
  matches what the page serves: active menu QR, active + published outlet, active organization; table
  and order QR codes are excluded so each store appears once. Capped at 45,000 menu URLs (one sitemap
  file); beyond that, split with `generateSitemaps`. Results are cached in-process for 10 minutes and a
  database failure falls back to the static pages. The demo menu is listed only when
  `DEMO_MODE_ENABLED=true`. No opt-in is required (owner decision).
- Public menus set a canonical URL (`?lang=` variants collapse to the base URL) and order tracking
  pages are `noindex`.
- The home page emits `Organization` + `WebSite` JSON-LD (`siteJsonLd` in `src/lib/marketing/seo.ts`).
  No ratings or unverified social profiles are claimed.
- `PUBLIC_ORIGIN` in `src/lib/marketing/seo.ts` is the single source for the canonical host.

Migration: 0112 is additive and forward-only (one function + grant); no data changes.

Operator follow-up: add `https://food.bababuilds.com` as a Search Console and Bing Webmaster property
and submit `/sitemap.xml`. Googlebot will now crawl store menus through the existing public-render
admission control; watch load after launch.
