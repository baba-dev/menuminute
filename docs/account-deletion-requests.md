# Account deletion requests

The **Owner's Office** on `/dashboard/organization` lets a signed-in person request deletion
of their **personal MenuMinute account**. This is not the same as suspending an organization or
deleting a restaurant. The button is available to people with access to the organization page,
not only the organization's owner.

## Request and withdrawal

1. The account holder confirms the request. `POST /api/account/deletion-request` verifies the
   session and organization membership and opens a **high-priority ticket** in
   `/admin/support`, with subject **Account deletion request**.
2. A separate database record stores the ticket reference, submitting user, creation time,
   seven-weekday deadline and cancellation state. Repeat submissions while pending return the
   existing ticket; they do not create duplicate requests.
3. The period starts on the day **after** submission. It includes seven **Monday–Friday UTC**
   dates. The user may withdraw until the end of the seventh weekday. The UI displays that
   date; public holidays are not automatically excluded and must be reviewed by the operator.
4. `DELETE /api/account/deletion-request` requires a signed-in account and explicit
   confirmation. The database changes the request to withdrawn, closes/renames the associated
   support ticket and appends an operator-visible explanation. Repeated cancellation or
   cancellation after the deadline is rejected.

## Administrator responsibilities

The ticket is a **manual review and processing queue**, not a destructive job.
The seven-weekday deadline is an operational target; the implementation does **not** claim
that merely resolving the support ticket destroys the account.

Before processing, confirm the person's identity, organization ownership, active paid
subscriptions, open refunds/disputes, shared restaurant records, access transfers, and lawful
retention obligations. Do not delete immutable financial history or another person's data.
Record the decision and completion in the support thread and perform deletion only through a
separately approved, verified account-erasure workflow.

**Always check the latest request state** before processing. A ticket with the subject
**Account deletion request (withdrawn)**, or a matching row with a non-null
`cancelled_at`, must never trigger account deletion. Do not rely on a stale ticket
notification.

A missed deadline, a legal hold, or processing after the self-service cancellation window
requires direct contact with the account holder and documented review. Public privacy
requests can still be initiated by email using `/delete-account`.

## Security and deployment

The migration `0078_account_deletion_requests.sql` requires the established schema owner.
The web role can only read its own request rows; mutations use transaction-scoped
`SECURITY DEFINER` functions. No worker role can create or withdraw requests.
The public demo is forbidden from raising deletion tickets.

Run the existing migration pipeline, integration tests, TypeScript checks and browser QA
before merging. The change does not automatically revoke sessions, delete accounts,
remove data, or introduce new environment variables.
