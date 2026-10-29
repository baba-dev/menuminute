# Admin UI production regression checklist

PR #215 reconciles the Ink & Ember console with current main. Never replace the newer Kitchen Pro grant and commercial-launch logic with an older visual branch.

## Required acceptance
- Inspect all eight /admin routes with explicit Light, Dark, and System themes at 360, 390, 768, 1024, and 1440 CSS pixels.
- Verify System follows operating-system changes; explicit overrides persist through reload and cross-tab updates.
- Check dark/light logo contrast, native form controls, tables, status badges, errors, disabled states, and WCAG 2.2 AA rendered contrast.
- Navigate entirely by keyboard, including Escape, focus trapping, focus restoration, nav drawer and audit/suspension dialogs.
- Confirm every administrative write enforces live superadmin authorization, step-up proof, database command safeguards, and audit receipts.
- Confirm plan name/status edits succeed without sending price changes. Provider price-release policy remains enforceable.
- Confirm tenant reactivation uses a fresh justification, not stale React state.
- Confirm paid Kitchen Pro activation, seven-day trial, permanent grants, outlet routing and non-Kitchen order board behavior remain intact.
- Exercise stale/offline telemetry, logs search, live-tail overlap, log export authorization, rate-limit clear and outbox retries.
- Run repository-pinned format, lint, strict typecheck, tests, production build and browser CI before approval. Preserve release gates.

## Scope restriction
The UI redesign must not modify schemas, migrations, paid entitlement logic, command authorization, payment posting or kitchen order-routing semantics.
