# P1 Atlas handoff and release gates

**Issue:** #363. **Source visual review:** `/mnt/data/atlas_design` generated November 22, 2026 (not committed). **Figma:** https://www.figma.com/design/LNd5ZhhFjbXrD8T4stV24m.

## Delivered in this PR
- Native Next.js 16 App Router routes: home, browse, search, all five editorial kinds.
- SSR-first content; no independent client-side search library, API provider or dependency.
- Bricolage Grotesque + DM Sans and responsive Ink & Ember styles, scoped under `.atlas-root`; respects existing light/dark/system theme.
- Accessible card links, mobile disclosure navigation, skip link, on-page article TOC, hero, fact cards, related reading, CTA and ad geometry for non-production visual review.
- 8 preview-only content profiles seeded separately from merchant menu source data.
- Typed schema, bounded aliases and search, reviewed-only sitemap rule, noindex for every preview.
- AdSense fail-closed policy. No actual third-party advertising code, network request or new user tracking.

## Verification requirements before merge

1. Run `pnpm install --frozen-lockfile`.
2. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
3. Run `pnpm test:e2e -- tests/e2e/food-encyclopedia-atlas.spec.ts` on the CI-supported runtime. Check both Playwright desktop and Mobile Chrome.
4. Confirm pages at 320/360/390/430/768/1024/1440 px, including dark/system mode, focus navigation, reduced motion and image-failure cases.
5. Inspect output HTML for correct canonical/meta robots, no ads, no third-party scripts, no unapproved JSON-LD claims.
6. Verify existing tenant/menu/checkout/ordering routes and on-host ERP isolation with the release checklist. A green CI run is not a production release.

## Still blocked for an actual organic-search/ads launch

- Source and editorial fact-checking, named reviewers, corrections workflow, approval of claims and media provenance.
- Durable PostgreSQL editorial storage, revision lifecycle and authorization-backed editor.
- AdSense domain acceptance, approved CMP with geographic controls, privacy review, ads.txt, slot IDs and explicit activation policy.
- Google Search Console and analytics verification, original content quality and measurable user value.
- Full source-asset-level Figma parity and native Figma refinement (Figma tool plan limit prevented final file editing).

No production deployment, data migration, advertising approval, traffic or revenue is claimed by this PR. Do not merge as a sign-off of those independent gates.
