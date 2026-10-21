# QR Studio 2.0 — The Tabletop Press (consolidated B–E)

Depends on #134, the approved seven-asset media package. This implementation retains the public route `/dashboard/qr-codes` and the existing outlet-authorized QR domain commands and authenticated download endpoints.

## Architecture
- `qr-manager.tsx`: UI transaction coordinator with a synchronous in-flight guard, durable retry key for uncertain command outcomes, explicit list reconciliation and selected-code state. Search/filter/24-at-a-time rendering is derived from the server-authorized outlet inventory.
- `qr-studio-types.ts`: pure inventory/counting, filtering and encoded public destination functions. Active service-point count is based on active `tableId`; we intentionally do not display fabricated scan analytics or equate QR activation with a published menu.
- `qr-print-sheet.tsx` and `qr-print.module.css`: three print variants (Table Stand, Window / Counter Sticker and Menu Insert), sourced from the *existing authenticated active-code SVG endpoint*. Decorative QR artwork is never treated as a scannable code.
- `qr-studio.css`: full-bleed desktop/portrait light/dark editorial art, open statistics and list navigation, accessible action targets and narrow-screen layout.
- `page.tsx`: private `noindex,nofollow` metadata and existing session/outlet/organization scope. `loading.tsx` and `error.tsx` provide accessible recovery.

## Security and UX invariants
- QR identity, destination token, old-print continuity, explicit revocation and regeneration all remain controlled by `app_private.qr_command`. There are no migrations or new direct DB grants. Server-side organization-admin authorization remains authoritative for revocation and regeneration. Unverified network results never show creation/revocation success.
- Destructive actions require a modal and a typed confirmation word. Regeneration explicitly warns that the canonical outlet public destination may rotate.
- Revoked codes do not display a downloadable matrix or print actions; download API already checks both outlet authority and active status.
- The printed QR preserves the server generator's error correction, quiet zone and canonical destination. The template keeps MenuMinute branding *outside* the matrix and advises scanning a real proof before distribution.
- The creation celebration only appears after a successful command **and** refreshed inventory contains the issued code. No creation is inferred from local state.
- Copy-link failure presents the selectable fallback URL; all downloads remain private/no-store. Selected printing is isolated to one code and one approved format.
- Portrait screen controls stay keyboard-accessible, use 44px targets, support reduced motion and use actual guest-meaningful copy.
- Build fails closed if any of the seven WebP assets differs from the approved manifest.

## Acceptance
Run `pnpm media:verify:qr`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` and `pnpm test:e2e` on the project’s isolated PostgreSQL/Redis ARM64 CI. E2E tests must cover creation, real PNG/SVG endpoints, three print formats, 320–1440px, dark/light media, link continuity, typed revocation and revoked destination 404.

Main merge and deployment require fresh main-branch aggregate CI, an immutable ARM64 artifact, full verified off-host backup, exact SHA cutover, public HTTPS verification and ERP health. No Kitchen Pro activation or payment changes.
