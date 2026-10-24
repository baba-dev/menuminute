# QR Studio 3.0 — Print Atelier (Scopes A–E)

Issue: #162. Builds on the merged QR Studio 2.0/#135 and uses the same approved seven-file WebP manifest. No new illustrations, schema changes, QR token changes, provider calls, lockfile or shared infrastructure edits.

## A. Split work areas
`qr-manager.tsx` owns verified outlet inventory, idempotent domain operations and shared QR selection. The existing dashboard route now offers **QR Library** and **Print Studio** as distinct, full-width work areas; the selected-code card is no longer the layout parent of printed materials. The server still supplies only authorized current-outlet codes. Outlet switches remount the manager via `key={outlet.id}`. The Print tab chooses only an active code; revocation never makes a retired matrix printable.

## B. Branding and artwork
The existing `print-studio-illustration.webp` and approved SVG centre mark appear in the studio, plus Lucide controls. These are decorative only; the scannable SVG still comes from the private `/api/qr/[qrId]/download?format=svg&inline=1` route. Reuse existing CSS theme tokens for light/dark Ink & Ember; no image download/CDN or asset-manifest updates.

## C. Print composition
`qr-print-contract.ts` specifies three bounded physical formats and their QR sizes: 110×145 mm stand, 83×83 mm sticker, 99×117 mm insert. `qr-print-sheet.tsx` distinguishes the templates, provides three palette choices, controlled invitation/supporting text and optional branding or fallback URL. None of these options changes the permanent destination. Settings are local to this editing session; persistence and batch production are intentionally future features.

## D. Proof and export
The printed sheet displays one authenticated matrix, with server-preserved quiet zone and brand outside the matrix. Printing is disabled until QR `onLoad`, a proof review checkbox, nonempty invitation and a successful no-store recheck of the authorized active-code endpoint; image decoding and font readiness are awaited. Browser Print offers both the user's real physical printer and **Save as PDF** (it is not a silent server-generated PDF download). `@page` uses A4 with physical sheet dimensions and print-color preservation; users are instructed to use 100%/actual size and scan a printed proof. The raw SVG/PNG download endpoints remain available and unchanged. The UI must not claim an unverified scan or printer success. A transient command response or revoked QR cannot manufacture a successful print state.

## E. Regression and release
Unit: print selection refuses revoked identities, sizes are bounded and copy is normalized. Browser: separate tab navigation, format-specific live preview, real matrix endpoint, customizable copy and palette, proof/print target, 320–1440px, theme, existing lifecycle and revoked destination behavior. Required commands: `pnpm media:verify:qr`, `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm test:e2e`; use final-SHA native ARM64 CI and independent review. Print-browser output needs manual spot-check on supported browsers and actual hardware/PDF for paper scaling and scan legibility.

No changes to PostgreSQL, Redis, financial functions, QR domain authorization, or deploy helper. Merge does not equal production activation. Keep release eligible only after exact-SHA gate, immutable artifact and verified production/ERP checks.
