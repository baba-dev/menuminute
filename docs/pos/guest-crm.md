# Guest CRM

Guest CRM is included automatically with a current Ordering, Kitchen Pro or Dedicated entitlement. It has no separate feature toggle or API credential.

## Cashier workflow

The POS mobile field is optional. Entering a number recognizes a returning guest when permitted. Lookup runs asynchronously and must not block checkout. The number is persisted atomically with the canonical order; old customer names and immutable receipts are preserved.

## Guest directory

The Guests destination in the Insights navigation opens the private guest directory. Staff can search by name or number, inspect outlet-scoped visits, and record optional names and private service notes. An administrator can erase the CRM profile and suppress further automatic recreation. Historical orders and receipts are not rewritten. Mobile numbers do not verify ownership and do not imply marketing consent.

## Security and deployment

The 0084_guest_crm migration adds organization-scoped profiles, outlet-aware order associations, private functions and historical backfill. Public, online and POS orders are recognized automatically when the number can be safely normalized. Invalid or ambiguous numbers are not linked.

Every API request checks an authenticated user, outlet permission, organization, and live paid entitlement; direct table privileges are revoked. Phone lookups have per-user Redis budgets. All response bodies are private and no-store.

Apply the forward-only migration before deploying CRM application code through the existing release workflow. No operator switch or manual plan activation is required. Validate migrations, security boundaries, mobile and desktop experiences, anonymous checkout, POS idempotency, duplicate numbers and suppression.
