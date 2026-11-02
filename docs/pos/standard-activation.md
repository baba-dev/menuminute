# Standard POS activation and cashier shifts

This release automatically activates ordinary POS for active, non-demo outlets belonging to
organizations with an active Ordering or Kitchen Pro entitlement, including Community Edition.
It does not create or expand any entitlement or alter the trial lifecycle. POS remains scoped to
authorized outlet staff; payment-provider activation and regulated document issuance are separate.

## Behavior

- An existing eligible outlet is enabled by migration 0099. New/renewed paid grants
  and new outlets are provisioned by 0097 triggers. Future-dated grants also activate on
  the first authenticated and authorized POS visit (0099).
- The normal POS captures _staff attestations_, not provider-confirmed money. A
  normal receipt is not a statutory invoice. The existing operator-only
  `pos_finance_gates` remain closed unless independently approved.
- Opening, adjusting and closing a register use a dedicated idempotent, audited
  shift command with cashier/manager permissions. Closing requires manager/admin/owner.
- An ordinary cash payment joins a register only when exactly one register is open
  for that outlet. Multiple open registers or no register means unassigned cash;
  the system never silently guesses. Previously posted attestations are not backfilled.
- Close reports include assigned staff cash and refunds handled by that shift,
  even when the original sale was in an earlier shift. Existing completed shift
  totals, tax documents and historical receipts are immutable.
  Reports show only genuinely unassigned staff cash as unassigned.

## Operations and release

- Apply 0097 -> 0098 -> 0099 in journal order. **Do not edit earlier migration files.**
- Verify the pre-deployment backup, migration checksums, service release SHA and
  independently reviewed finance permissions. Existing data is preserved.
- Exercise a paid outlet with no prior POS settings, one with seller details,
  an unaffiliated user, a future-start entitlement, and a non-entitled outlet.
  Validate open/movement/close, a cash refund, multiple cashiers and ambiguous
  registers, command replay, prohibited direct table reads, and denied invoice issue.
- No configuration key, manual admin toggle or payment-provider credentials are
  required for ordinary POS shifts. Do not enable Stripe, fiscal approvals or
  registered invoice issue just to activate a register.
- On an entitlement expiry, accepted historical orders, receipts, and reports
  remain readable. This change does not introduce a new subscription paywall for
  manually enabled legacy outlets; review the commercial migration separately.

## Important commercial choice

Ordering and Kitchen Pro both receive normal cashier shifts in this release.
The earlier draft plan table reserved shifts for Kitchen Pro; that draft is
superseded for POS shift access by this owner-requested rollout.
