# home-v2: "Checked. Recorded. Reviewed." (section 5)

Status: **built and previewed** at `/home-v2` (`noindex`, not in the sitemap), after
[PDF to live menu](home-v2-pdf-to-menu.md). It is a "try to break it" trust section. The three demos are
illustrative models of rules the product enforces; they run on sample data in the browser, and the page
claims no certification, uptime figure, encryption statement or compliance.

## The rule for this section

A trust section is only worth anything if every claim is true. Each statement below was checked against
the code or the product's own docs before it went on the page. `docs/domain-invariants.md` says its rules
are targets, so it was not treated as proof.

## What is on the page

| Demo                       | What the visitor does                                                | Verified against                                                                                                |
| -------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Who can do what?           | Picks a person, an action and an outlet; sees three checks and a 403 | `app_private.can_outlet` in `src/db/migrations/0001_tenant_security.sql`; `withOutlet` in `tenancy/service.ts`  |
| Try to cheat the checkout  | Sends an order, taps twice, changes the cart or edits the total      | `submitGuestOrder` in `src/modules/orders/service.ts` (key and request hash, then quoted total vs server total) |
| Try to erase what happened | Tries to delete an order that has a status history                   | `order_status_events` (actor type guest, staff or system) references `orders` with `onDelete: restrict`         |

- **Access model** mirrors the SQL exactly: active member required; billing is owner only; owner and admin
  can do everything else at the organization's outlets; other members need an outlet role (manager,
  service, kitchen, menu editor) that holds the permission. Removed staff and people from another
  restaurant fail the membership check, and the grant check is shown as not reached.
- **Checkout model** mirrors the order of operations: look the key up first (same key and same cart returns
  the existing order; same key and a different cart is a conflict), then compare the quoted total with the
  server's own total (a mismatch is a conflict and creates nothing). Messages are the product's own.
- **History model**: the ledger shows the actor types the product records. Deleting is refused because the
  history rows restrict deletion of their order.

Fact cards (each backed by the docs): authenticator-app two-factor sign-in with backup codes and a recent
second-factor confirmation for sensitive actions (`/docs/organization`, better-auth `twoFactor`);
guests need no account and follow an order with an opaque tracking token (`tracking_token`);
AI output is an untrusted draft that never sets allergens, dietary claims, prices or order acceptance
(`docs/dish-ai-autofill-hardening.md`, `/help/owner/ai-menu-import`). Privacy and terms link to the real
pages.

## Deliberately not claimed

Certifications, uptime or SLA figures, encryption at rest or in transit, data region, backup or restore
status, penetration tests and customer counts. Backups and off-host alerting are operator-backed launch
gates that this change does not prove (see `docs/orchestration/phase-4-ops-evidence.md`), so they stay off
the page until evidence exists.

## Behaviour and accessibility

- Selecting a person, action or outlet updates the result immediately; the three checks animate in order,
  and a refusal shakes (transform only). Rolling counters show taps and orders created.
- Real controls with labels (`select` with a visible label, `aria-pressed` toggles, an input labelled
  "Total the phone sends"); results are announced through one polite live region; each check exposes
  passed, failed or not reached as text.
- `prefers-reduced-motion: reduce`: no animation or transition; every demo still works. Without script
  nothing is hidden; the demos need script.

## Files

- `src/components/marketing/trust/` (`trust.tsx`, `-logic.ts`, `-fixture.ts`, `.css`)
- Uses the shared `RollingNumber` and `useSectionMotion`. Mounted in `src/app/home-v2/page.tsx`;
  `.tr-container` joins the shared grid in `src/app/home-layout.css`.

## Verification (last run)

- `tests/trust.test.ts`: 17 tests (the permission matrix for every example person, billing owner only,
  check steps, the four checkout outcomes and their messages, state immutability, history, links against
  the help and docs registries, and a scan for certification, uptime and encryption wording).
- `tests/e2e/home-v2-trust.spec.ts`: 6 scenarios on desktop and Pixel 5 (12 runs): access results,
  checkout outcomes, refused deletion, honest copy and links, overflow and axe WCAG 2 A/AA, reduced motion.
- Earlier sections' specs still pass. `tsc --noEmit`, eslint and prettier are clean for the changed files.
  The full `next build` needs real production configuration and was not run here; CI covers it.
