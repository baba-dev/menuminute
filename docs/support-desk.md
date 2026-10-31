# Support desk

Operators raise support requests; platform admins work them in **Admin → Support Desk**
(`/admin/support`).

## For operators (Ember)

- "Raise a support request, the printer is broken" → Ember prepares a request and shows a card with
  the subject and a short excerpt. Nothing is sent until **Confirm** (see
  `intelligence-action-requests.md`). Requires `AI_ASSISTANT_ACTIONS_ENABLED`.
- "Show my support tickets" / "any reply?" → read-only `support.myTickets`: their own requests, a
  plain progress label and the latest **public** reply. Internal notes are never returned.
- Limits: 10 requests per person per 24 h, 50 open per organization. The public demo tenant cannot
  raise tickets.

## For platform admins

- List with status tabs and live counts, search (subject, `#number`, person, email, restaurant),
  priority filter and an Archived view. One indexed read plus one grouped count; no tenant joins
  (display names are snapshotted when a ticket is raised). Pagination fetches one extra row instead
  of counting.
- Ticket panel: original request, replies, internal notes, status, priority, assign-to-me, archive /
  restore. A visible reply to an open ticket moves it to **Waiting on operator**.
- "Delete" is an archive: rows are never destroyed through the application.
- Every change writes an admin audit entry in the same transaction (action, ticket id, what
  changed). Reply text is deliberately **not** copied into the audit log.

## Data and access (migration 0066)

- `support_tickets`, `support_ticket_messages`. Web roles have `SELECT` only; every write is a
  `SECURITY DEFINER` function. Row security: an operator sees only their own non-archived tickets and
  public messages; a platform admin (live session, verified email, 2FA — the database enforces this
  in `is_super_admin`) sees all.
- Routine ticket handling does **not** require per-action step-up, unlike platform mutations through
  `admin_command`. Revisit if replies ever carry sensitive actions.
- Same owner-policy pattern as 0064/0065 so the functions work when the migration owner is a plain
  role; `tests/intelligence-definer-rls.test.ts` covers it.
- Rollback: forward migration dropping both tables (and the `support.ticket` kind from the
  `assistant_action_requests` check). No other table references them.
