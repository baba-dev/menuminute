# MenuMinute Dashboard 2.0 — implementation contract

The approved Editorial Table screenshot is the reference. This route renders actual outlet state, not a screenshot or mock data.

## Media

PR A contains four compressed WebP originals. The two mobile sources were uploaded under the literal names hero-mobile-light.webp.png and hero-mobile-dark.webp.png, containing PNG bytes. scripts/dashboard-media.mjs verifies those sources and exports true compressed 960x1120 WebPs during dev and production build. The page serves only the generated mobile WebP outputs, rather than the multi-megabyte PNG masters. The desktop heroes remain full-bleed within the workspace. All heading/button text remains live HTML. Decorative images have empty alt text.

## Real KPI contract

- Published menus/categories/dishes come only from the current immutable guest-facing projection.
- Active QR codes count only active menu-purpose identities.
- Menus to publish is the number of menus with saved unpublished revisions, NOT individual changes.
- A Live status and public preview link require an active QR resolving to a public release.
- Setup is four verifiable steps: outlet configured, saved menu exists, public release exists, and active menu QR exists.
- All actions link to real merchant routes. No simulated revenue, guest traffic or timestamps.

## Verification

Login/MFA policy and outlet-scoped access remain unchanged. The authenticated workspace has noindex/nofollow metadata, not public marketing SEO. The navigation marks its current page, the outlet chooser provides accessible error feedback, Radix tooltips support keyboard/focus, and reduced-motion preferences are honoured.

Test sizes: 360, 390, 768, 1024, 1440; light/dark, no outlet, unpublished menu, revoked QR, zero drafts and long outlet names. Release only after required CI gate, exact ARM64 artifact publication, verified deployment and activated service health. No schema, migrations, release helpers or commercial activation are modified.
