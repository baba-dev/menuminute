# Menu Studio 3.0 — Recipe Atelier implementation (PR B–E)

The approved seven-artwork media dependency is PR #132, now merged. These files are immutable, manifest-checked source assets in `public/brand/menu-studio/recipe-atelier/`. Production build invokes `scripts/verify-menu-studio-media.mjs` and fails if any WebP dimensions, transparency, bytes or checksum differ.

## Architecture

- `menu-studio.tsx`: existing client-side transactional editor state, selected menu, revision/idempotency keys, Smart Composer orchestration, section navigation, validated saving and publishing.
- `studio-chrome.tsx`: full-width theme-aware hero, real editable-draft KPI rail and explanations, human-review import handoff, persistent action dock, preview outline, empty and server-confirmed success states.
- `studio-fields.tsx`: reusable controlled text/decimal controls. Decimal text is not rewritten while being entered, and values use `displayToMinor`.
- `studio-dish-editor.tsx`: full advanced dish controls, including dietary flags, variant availability, add-on constraints, images, schedule and order.
- `studio-resources.tsx`: isolated media rights/approval process and shared-menu assignments, outlet-local overrides, unpublish/archive/restore.
- `studio-atelier.css`: scoped Ink & Ember visual language; 2880×800 desktop art and distinct 960×1000 portrait art; no painted UI text.
- The server route exports private noindex/nofollow metadata and retains existing login, outlet-scoped service queries and MFA layout gate.

## Non-negotiable behaviour

- Selected-menu and section filters never silently mutate the source document.
- Unsaved editor fields and pending Composer items are guarded on switches and browser leave. One synchronous operation lock prevents overlapping UI commands.
- The original command API retains expected revision checks and stable idempotency keys. Uncertain outcomes are not displayed as success.
- Draft Save is distinct from Publish. Only a committed, server-confirmed publish displays the celebration illustration and live message. QR identity remains unchanged.
- Public full preview uses the existing `PublicMenu` projector with `preview` and a private draft payload. The small companion panel is a clearly labelled draft outline, never a claim that guests can see local changes.
- Dish photos remain private until processed, approved, assigned and published. Imported candidates require source-aware human review and explicit draft application.
- Shared-menu publishing and assignments continue through the existing domain authorization contract; no direct DB writes, bypasses or migrations are introduced.

## Acceptance / verification

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and the existing `pnpm test:e2e` against isolated PostgreSQL/Redis and browser fixtures, preserving the four-lane required CI. The build invokes the seven-media verifier. Browser tests include 320/360/390/768/1024/1440 widths, dark/light, keyboard help, full private preview and real save/publish/QR/media lifecycles. Confirm archive/read-only, long names, zero menus, no pending imports, revoked access, slow network and failed load/error states.

PR B–E changes authenticated Menu Studio only; no database schema, deployment helper or Kitchen Pro monetization changes. Merge and production deployment require fresh current-main CI, exact ARM64 artifact publication, the full Restic backup/cutover gate and public-service verification.
