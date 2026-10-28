# QR Studio 4.0 — Connection Atelier and print styling

Work package: #200. Source baseline: main at 1f9a35310671e5f13bdd5622b342eafecc6b65a5.

## Intent
- Replace the scroll-to-inline creator with an accessible Radix modal wizard (configure, review, server-confirmed success); remove the inline section, old celebratory banner and dead styles.
- Keep **one existing** idempotent QR command path in qr-manager; do not create or mutate tokens in the browser. A successful creation is shown only after a verified refresh identifies the returned code.
- Keep menu-level and labeled service-point modes. A service-point label provides context, not physical-presence proof or ordering entitlement. The print-tab empty state can launch the same creator.
- Nine print themes use separate backgrounds, typography treatments and decorations within existing physical sheet sizes. Five self-hosted (next/font) typography choices apply to restaurant and invitation headings.
- Colour the QR *only* through the authenticated download endpoint after validating a six-hex-digit dark ink with a minimum 7:1 contrast ratio against solid white. Old download URLs without an ink query remain black. Quiet zone remains at four modules.
- MenuMinute · by BabaBuilds is permanently in print output outside the QR; no bypass toggle.

## Preserved invariants
1. app_private.qr_command remains the durable command authority. The existing client retry UUID, in-flight guard, inventory refresh, selected-ID reconciliation, destructive confirmations and per-outlet server context are retained.
2. QR identity, public destination URLs, outlet context, revocation behavior and raw download defaults do not change. No migrations, Redis, media manifests or payment dependencies are introduced.
3. Print is gated on active authorized selection, revalidation of active private SVG, decoded QR, loaded fonts and a user proof check. An appearance change clears the print proof state. Browser print/Save as PDF does not imply a verified physical scan.
4. The colour endpoint independently rejects invalid ink. CSS themes never tint an untrusted QR with filters or reduce the QR quiet zone.

## Required evidence
- Unit: template sizes, no revoked QR, fixed destination, nine themes, five fonts, mandatory signature on all physical formats, malformed/light colour rejection, unchanged no-colour default.
- UI: wizard step transition, validation, success, keyboard focus and focus restore, no duplicate create under busy state.
- Browser: desktop 1440/1024 and phone 768/375/320, light/dark themes, printed PNG/SVG and Save-as-PDF proof, fallback URL and long restaurant names.
- Manual: scan real printed proofs at ordinary distance, across all three physical formats and representative ink colours. Browser screenshot tests cannot replace physical scanner testing.
- CI: pnpm format:check, lint, typecheck, test, build, media:verify:qr and relevant Playwright lanes on final SHA; do not mark production-ready before verified CI plus physical proof.

## Operational considerations
- Generated colour is a presentation-only choice. Copying or editing printed styles never regenerates the QR destination token.
- No persistent per-outlet print preferences in this scope; changes last for the current studio session.
- The app's root next/font build now includes Playfair Display and Bebas Neue, alongside existing DM Sans, Bricolage Grotesque and Kalam. Fonts are self-hosted at build output, not loaded from a font CDN in the print browser.
- Rollback: revert these UI, print CSS, and ink changes. Existing printed black QR and permanent URLs remain valid.
