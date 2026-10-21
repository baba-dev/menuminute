# QR Studio 2.0 — The Tabletop Press (PR A)

This is the intended destination for MenuMinute's **seven compressed production WebPs**. The directory intentionally contains only documentation and the checksum manifest until the media binaries are uploaded to this draft PR. It is a media dependency, not a deployed interface change.

## Upload the seven assets to this PR

1. Download **`menuminute-tabletop-press-all-seven-media.zip`** from the ChatGPT handoff and extract it.
2. In GitHub, select the PR's feature branch `design/qr-studio-tabletop-press-pr-a` (not `main`).
3. Navigate to `public/brand/qr-studio/tabletop-press/` and choose **Add file → Upload files**.
4. From the extracted ZIP's *matching folder*, upload only these seven WebPs, without renaming:

| Filename | Pixels | Alpha |
| --- | ---: | --- |
| `hero-desktop-light.webp` | 2880 × 800 | Opaque |
| `hero-desktop-dark.webp` | 2880 × 800 | Opaque |
| `hero-mobile-light.webp` | 960 × 1000 | Opaque |
| `hero-mobile-dark.webp` | 960 × 1000 | Opaque |
| `first-qr-empty-illustration.webp` | 700 × 600 | Transparent |
| `print-studio-illustration.webp` | 640 × 480 | Transparent |
| `qr-creation-celebration.webp` | 600 × 450 | Transparent |

5. Commit to **the same feature branch** with message `assets(qr-studio): upload seven Tabletop Press WebPs`.
6. The existing `README.md` and `manifest.json` are already committed. Do **not** upload the ZIP, its `PREVIEW.jpg`, or `UPLOAD-INSTRUCTIONS.md` into `public/`.
7. With dependencies installed, run `node scripts/verify-qr-studio-media.mjs`. It must report `TABLETOP_PRESS_MEDIA_VALIDATED: 7/7`.
8. Inspect the PR's Files changed (all seven WebPs must be present), run required CI, and only then mark this PR ready to merge.

## Integration contract for the next implementation PR

- URL prefix: `/brand/qr-studio/tabletop-press/`.
- Full-width editorial desktop and portrait mobile heroes, switched through the existing application's pre-paint light/dark theme. All headings, buttons, labels and links are live, accessible HTML and must not be painted into the artwork.
- The three spot illustrations are decorative: use `alt=""` when their surrounding HTML already explains the corresponding state. Success artwork appears **only after server-confirmed QR creation**.
- **Critical: every depicted QR matrix in the generated artwork is illustrative and must never be displayed or exported as a functioning, scannable QR.** Real download/print outputs must use MenuMinute's authenticated QR generator and true destination data, preserving adequate contrast and quiet zones. Print Studio templates should use dynamic HTML/CSS or vector branding outside the generated matrix.
- This media PR makes **no changes** to QR destination identity, revocation/regeneration, outlet isolation, idempotency or the live restaurant menu.

This is a media-only PR; do not merge a manifest-only PR.