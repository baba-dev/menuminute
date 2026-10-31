# Workspace Sidebar 2.0

Implemented on the `feature/sidebar-2-0-navigation-space` branch (2026-10-31).

## Behavior

- The authenticated dashboard shows an outlet selector only when a member has **two or
  more active, authorized outlets**. A zero/one-outlet account proceeds directly from the logo
  to the navigation. No redundant outlet name or currency is shown.
- The desktop workspace sidebar no longer contains an avatar/profile footer or a logout
  shortcut. Account access remains in the top bar and mobile More; the Account page provides
  an explicit session sign-out action. Account Security retains device/session controls.
- The existing native outlet switcher continues calling `POST /api/context`; tenant
  permissions, persisted preferences, and error feedback are unchanged.
- Navigation links shrink/wrap inside the fixed sidebar width instead of generating horizontal
  scrolling. Vertical scrolling is retained when zoom, viewport height, or expanded Add-ons
  require it.
- The original mobile bottom bar and More sheet remain the primary small-screen navigation.
  Platform admin is shown within the desktop Admin group and mobile More only for an
  authenticated super-admin, with authorization still enforced on `/admin`.

## Verification and release

Run `pnpm exec vitest run tests/dashboard-shell-ui.test.tsx tests/account-sign-out-button.test.tsx`,
`pnpm exec playwright test tests/e2e/shell-navigation.spec.ts`, `pnpm lint`,
`pnpm typecheck`, and `pnpm build` on the candidate commit. Browser tests require
the isolated `menuminute_test` PostgreSQL database and the existing test server.

No schema migration, payment behavior, role grants, or environment change is required.
The change is reversible by reverting the PR. Passing PR CI alone does **not** constitute a
production deployment or verified host readiness.
