# Search indexing (SEO)

Status: implemented in code; Search Console verification and submission are operator steps and
have **not** been done.

- `src/app/robots.ts` → `/robots.txt`: crawlable marketing, help, docs and `/m/` public menus. Blocks
  API, admin, dashboard, kitchen, account, auth flows, `/home-v2` and guest order tracking
  (`/m/*/orders/`). robots.txt controls crawling only; private pages also set `robots: { index: false }`.
- `src/app/sitemap.ts` → `/sitemap.xml`: static marketing pages, feature and solution pages, help and
  docs articles, plus the single public demo menu when `DEMO_MODE_ENABLED=true`. Customer
  restaurants' menus are deliberately **not** enumerated; they stay reachable by their QR link.
- Public menus set a canonical URL (`?lang=` variants collapse to the base URL) and order tracking
  pages are `noindex`.
- The home page emits `Organization` + `WebSite` JSON-LD (`siteJsonLd` in `src/lib/marketing/seo.ts`).
  No ratings or unverified social profiles are claimed.
- `PUBLIC_ORIGIN` in `src/lib/marketing/seo.ts` is the single source for the canonical host.

Operator follow-up: add `https://food.bababuilds.com` as a Search Console and Bing Webmaster property
and submit `/sitemap.xml`. Indexing menus of customer restaurants would need an explicit per-outlet
opt-in and is not built.
