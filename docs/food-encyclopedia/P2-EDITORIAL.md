# P2 — Food Encyclopedia Editorial Engine

Work package [#367](https://github.com/baba-dev/menuminute/issues/367), based on approved Atlas P1 [#364](https://github.com/baba-dev/menuminute/pull/364).

## Safety-first workflow
Draft -> Submit for review -> Distinct human superadmin approval -> Publish immutable revision. Saving after publication creates a new draft, leaving the old published revision intact. Restoring a previously approved revision is an audited publication. No automatically published AI, OCR or dish-catalogue data. Unverified foods must never be marked allergen-safe. Each publication requires a named reviewer and a separately authenticated publishing action.

## Migration ownership and dependency
- P2 reserves **0117_food_encyclopedia_editorial**. Concurrent Tiffin [PR #366](https://github.com/baba-dev/menuminute/pull/366) contains 0115 and 0116.
- The migration journal and final SHA **must be reconciled after #366** before merging P2. P2 cannot be merged/deployed against a migration history that skips 0115/0116. Do not force-merge around the ledger.
- All P2 SQL is additive; app/worker have no direct table privileges. Existing merchant schemas, orders, checkout and ERP remain untouched. The migration owner installs only reviewed SQL after a verified encrypted off-host backup.
- Reviews use session + active 2FA + one-use step-up via app_private.require_step_up(), with source and actor audit in the same transaction. A reviewer cannot approve their own authored revision.

## Public and advertising
- Published content is a whitelisted JSON projection from a narrow SECURITY DEFINER read gateway; drafts and internal notes cannot be fetched on public endpoints.
- SSR search and sitemap consider only published revisions. Preview-only P1 fixtures remain noindex and never become published without independent review.
- AdSense is disabled. Publication is **not** consent/ads activation.
- A missing migration or read failure never leaks private data or incorrectly flags an unpublished entry as indexed.

## Validation
Use frozen-lockfile install, TypeScript, lint/Prettier, Vitest integration, ARM64 Next compile, Playwright and independent database privilege review. Production releases require v7 helper, schema+media backups, exact-SHA checks, ERP coexistence checks and forward-only migration safety. A green PR is not production deployment.

## P2 implementation update
- Eight logical commits delivered on the PR branch, plus QA corrections as required.
- Real database published pages supersede P1 sample previews. In production, no sample article is indexable or served as a substitute for reviewed content.
- Public pages fail closed on missing migration or empty editorial store. Search excludes unapproved data, ad slots remain inactive.
- The editorial form requires manual explicit Save with step-up; unattended autosave is intentionally not enabled, to avoid bypassing one-use administrator verification.
- A separate independently approved superadmin is necessary to approve an author's submission; never self-approve.
- **Migration dependency**: PR #366 has 0115/0116 but another branch added 0115 receipt UPI to current main. Coordinate migration renumbering and journal sequence before merging P2; no merge/deploy until conflict resolved.
