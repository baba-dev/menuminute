# Dashboard 2.0 — implementation and asset handoff

This branch changes the private merchant dashboard only. It does not run SQL migrations, modify the ERP, rotate QR identities or change a restaurant's pricing.

## Layout
1. The shared dashboard topbar calls the guest-facing link **Public menu**.
2. Hero CTA opens **Dish Availability**, a scoped published-dish grid.
3. **At a Glance** is immediately below the hero. **Today's priorities**, **The Service Dispatch**, and **Outlet health** follow.
4. Dining Room and Guest Service occupy the bottom operational section.
5. The old standalone 86 Board is no longer rendered; no guest-facing draft edit is made by the new modal.

## Production SVG artwork — owner upload required

Upload these exact files to \`public/brand/dashboard/editorial/\` on the PR branch:

- \`service-dispatch-light.svg\` / \`service-dispatch-dark.svg\` — 600 × 420
- \`dining-room-empty-light.svg\` / \`dining-room-empty-dark.svg\` — 640 × 480
- \`dish-availability-empty-light.svg\` / \`dish-availability-empty-dark.svg\` — 480 × 360

Guest Service reuses the Service Dispatch illustration until a separately approved guest-request illustration is produced. Existing hero, priorities and outlet-health artwork stay unchanged.

Confirm actual SVG responses (200 + \`image/svg+xml\`) in both themes after upload. These external owner-supplied art assets are not fabricated by this PR.

## Availability invariant
- The server-rendered list comes from the guest-visible committed release and active outlet QR token. Private draft dishes are excluded.
- Mutations use the existing authenticated \`/api/catalog/:menuId\` command with a fresh menu revision and a unique idempotency key.
- A GET before each write compares the current published dish and outlet override with the visible status. If changed elsewhere, the mutation fails closed with a refresh request instead of blind overwriting.
- Local price overrides are preserved. The other outlet's override is never read as a value for this outlet. Published menu assignments and \`menu.write\` must be permitted server-side.
- This is stock availability, not an assertion that a dish is orderable outside its schedule or with unavailable variants/add-ons.
- A successful override does not publish unrelated private draft changes. Server order validation remains authoritative.

## Live service invariant
- Service Dispatch uses the existing \`/api/dashboard/pulse\` response; ready/restricted/unavailable states are not conflated.
- Polling still pauses in background tabs and keeps the error boundary independent of menu and QR data.
- Timestamps display in the outlet's configured IANA timezone.
- Dining Floor and Guest Service continue their existing outlet-scoped reads/writes, placed below the priority panels. One failing module does not hide the other.

## Verification / release gates
Run on the final branch SHA after owner artwork upload:
\`\`\`sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e -- tests/e2e/dashboard-editorial.spec.ts
\`\`\`

Manual/automated browser matrix: 320, 360, 390, 480, 768, 1024, 1440 and 1920 px; light/dark; keyboard and reduced motion; zero, one and many published dishes; multi-menu; revoked write access; concurrent saves and changed menu revisions; Android/iOS inset; slow images and offline/reconnect.

Test status must not be claimed passed until GitHub Actions reports for the current head SHA. No production deploy or merge is included in this PR. The usual native ARM64 gates and verified artifact/ERP coexistence requirements remain mandatory.

## Rollback
Revert the feature PR. No migration rollback or data deletion is needed. Availability overrides written by authorized staff remain legitimate business state and are not reverted just because the presentation code is rolled back.
