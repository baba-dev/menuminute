# Point of Sale 2.0 — Unified Order Intake & Cashier

Status: single-branch implementation A–H; **review, green exact-head CI, and migration preflight required before production release**.

## Source of truth
- One canonical `orders` row from staff POS or public customer menu. `intake_source` is assigned by a database trigger from trusted actor / tracking context; public menu submissions are **not proof** a physical QR scan occurred. Existing unprovable origins remain `unknown`.
- Staff POS submission `pos_submit_and_dispatch` wraps order/payment attestation and authorized `pending -> accepted` transition in one transaction. Failure of kitchen routing rolls back the entire staff submission. It does **not** switch on any finance provider, fiscal gate, or Kitchen Pro capability.
- Customer inbox includes only `pending` `guest_menu`/`online` orders. `pos_accept_customer_order` atomically accepts the order and creates exactly one `pos_sales` association, reusing the existing canonical Kitchen Pro acceptance trigger and actor/outlet checks. Existing completed/paid orders are not silently backfilled.
- Intake toast is optional UI. Dismissal cannot mutate order state. Failed synchronization preserves a visible error, and the order is still server-persisted while the POS browser is closed.
- All collection / fiscal modes remain operator-gated. Mark as Paid is staff attestation, not payment provider confirmation. Thermal printing produces a provisional bill, not a jurisdiction-certified invoice.

## KPIs
Four cards: paid orders placed during the outlet-local day net of recorded refunds, published menus, unique published dishes, and canonical orders placed today across all sources (including cancelled/rejected). The first metric is **order-day paid sales**, not an accrual or settlement-time cash-flow ledger; late settlement and late refunds can affect period reconciliation. Never calculate revenue from the bounded register page. Never claim a partial/uncertain payment is a verified electronic capture.

## Register
The order register reads canonical orders (including those not yet associated with POS), with outlet-scoped permission checks, date/source/payment/state filters, item search, and keyset pagination ordered by `(created_at,id)`. Server holds identifiers, not long-lived guest capability tokens. Operational UUIDs are hidden under Technical details.

## Device/UX
- Desktop: published menu, one-tap cart and persistent order pad; complex modifiers in nonblocking inline editor.
- Mobile: bottom ticket affordance, scrollable ticket surface, accessible Escape to close; overlays must not interfere with payment controls or Ask Ember.
- Incoming alerts: 5-second visible-tab polling with online/visibility recovery and optional browser sound. Backend remains authoritative and can accept orders when cashier UI is closed. Alert notification is not delivery assurance.

## QA and release criteria
- Run formatter, ESLint, strict TypeScript, isolated PostgreSQL and Redis integration, Playwright and ARM64 production build on the exact PR head.
- Validate A/B migrations `0040` / `0041` with the journal and deployed checksums; never modify prior applied migration files.
- Concurrency: same-key staff submit, two cashiers accepting one QR order, stale-version conflict, denied permissions, wrong outlet, failed kitchen routing, blocked popup, lost HTTP response and retry.
- Observe order.created/order.status_changed outbox backlog and Kitchen Pro station routing. Review payment and receipt evidence before release. Use safe progressive deployment; never delete financial history on rollback.
- Test responsive light/dark at 360/390/768/1024/1440/1920, keyboard focus, screen readers, reduced motion and device printing. No production ERP changes.

## Known follow-ups
- Complete legal fiscal adapters, verified tender flows and jurisdiction review separately.
- Native push delivery and sound requires a worker/signed subscription; the current first release uses bounded foreground polling with recovery.
- The QR route and a direct public-menu URL share the trusted `guest_menu` channel. Future attribution may track signed QR provenance separately.
