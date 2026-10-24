# CI transport and issue reconciliation — 2026-10-25

## Verified baseline and limited scope

Issue [#66](https://github.com/baba-dev/menuminute/issues/66) describes a cache/artifact transport outage, not a source-test regression. Historic [run 39052373750](https://github.com/baba-dev/menuminute/actions/runs/39052373750) failed after packaging; on audited main `03c40f738e0634c4eb4e233153113c1fe11da275`, [CI 40116447137](https://github.com/baba-dev/menuminute/actions/runs/40116447137) and [verified deployment workflow 40118522410](https://github.com/baba-dev/menuminute/actions/runs/40118522410) succeeded. Historical successes do **not** validate this PR head, host restore, or all launch requirements.

Cache retrieval/upload for pnpm and Playwright Chromium is optional. If the cache service is unavailable, frozen-lockfile installation and browser installation must continue. Diagnostic browser screenshot/test-results artifact uploads are attempted **only after failure** and are also optional. This changes transport error handling, not application behavior.

**Mandatory guards stay mandatory:** the exact tested native ARM64 production archive and SHA-256 sidecar must both be present; archive upload remains fatal on error. The source CI run/SHA publisher provenance, checked digest, supersession checks, PostgreSQL/Redis tests, Ember browser lane, migration history protections, host readiness and aggregate quality gate are unchanged. The failed source SHA or a rebuilt VPS artifact must never be substituted for the tested archive.

## On a recurring GitHub transport incident

1. Inspect queue/wait, dependency install/cache, native build, Playwright, release packaging, mandatory archive transport, publisher, staging and activation timings separately in Actions. Do not mislabel an artifact-service outage as a product-test failure.
2. If only an optional cache step fails, confirm the subsequent frozen install and full test suite passed. If only diagnostic evidence transport fails, the earlier source test result remains authoritative.
3. If **mandatory** archive upload fails, release gate fails and no publication/deployment is allowed. Retry the exact source CI SHA after GitHub recovers; do not handcraft, rename, rebuild, or partially reuse an archive. A newer main SHA requires its own end-to-end verification.
4. Compare source CI run ID, source SHA, checksum, publisher handoff, live web/worker SHA, public readiness and ERP HTTP 200 before calling a release activated. Under-ten-minute total time is a target, not a guarantee.

## Boundaries of repository issue closure

At the beginning of this audit, several still-open work packages had already landed in merged PRs: Food Orbit [#80/#81](https://github.com/baba-dev/menuminute/pull/81), import review [#111/#113](https://github.com/baba-dev/menuminute/pull/113), Menu Studio [#112/#114](https://github.com/baba-dev/menuminute/pull/114), and Ember read-only tools [#156/#158](https://github.com/baba-dev/menuminute/pull/158). These four implementation tickets (#80, #111, #112 and #156) have since been reconciled and closed with evidence comments, alongside foundation delivery tickets #7, #9, #10 and #18. This is **not** closure of their overarching release epics or operational acceptance gates. New dashboard failure-containment issue #166 is being addressed in a separate active PR #167; do not race that implementation writer.

Other open tickets cannot honestly be resolved by a source change alone: [legal Terms approval #121](https://github.com/baba-dev/menuminute/issues/121), [real isolated forced-RLS restore #131](https://github.com/baba-dev/menuminute/issues/131), Phase 4 SQL+private-media restore/alerts/merchant QA/ERP observations and Phase 5 production launch approvals. Preserve those gates and request dated operator evidence; do not assert nonexistent counsel approval or production drill results.

## Testing and rollback

- Before merge: Prettier, lint, TypeScript, Vitest including deploy contract coverage, PostgreSQL/Redis integration, production ARM64 build, both browser lanes and the aggregate gate on the **final** PR head.
- Fault-check: cache transport failure should be nonfatal only when install/verification still passes. Mandatory release archive upload failure must block its own lane and the aggregate quality gate.
- Revert this commit to restore the original cache/evidence policy. No runtime source, schema, historical migrations, media, ERP or server helpers are modified.
