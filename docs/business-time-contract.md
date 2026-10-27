# MenuMinute business time and timezone integrity

## Scope and invariant

Every outlet must store a canonical IANA timezone that the running Node.js ICU
and PostgreSQL installations both recognize. A human-readable offset (e.g.
UTC+05:30) is not a timezone: daylight-saving and historic rules belong to the
named timezone. Do not derive operations from the browsing user's device clock.

- **Instant:** absolute `timestamptz` for creation, transition and payment events.
- **Local date:** projection of an instant into the outlet's timezone.
- **Order business date:** immutable date attached to submission, used for daily
  order numbers and original transaction grouping.
- **Completion date:** projected from the first served/collected transition event.
  It is not the original order business date.
- **Shift/day boundary:** separate future configurable cut-off; do not silently
  change the order business-date contract.

### Preventing invalid zones

Onboarding and Organization writes normalize a small list of proven aliases.
The server publishes timezone options from the intersection of JavaScript ICU
and PostgreSQL's catalog, and confirms actual SQL conversion before a write.
Migration 0030 installs a trigger guarding future direct SQL writes, including
`SECURITY DEFINER` provisioning paths. It repairs only the known equivalent
`Asia/Calcutta` alias and stops deployment on remaining unsupported stored
zones rather than guessing.

### Changes after operations start

Changing an outlet timezone affects future schedules and locally projected
dates, but never rewrites existing `business_date` or order-number sequences.
Administrators should confirm timezone changes explicitly. If an outlet truly
relocates, reconcile reporting with an audited procedure; do not bulk rewrite
orders. Historical audit instants remain unchanged.

### Availability and reporting

Menu publishing, pickup slots, expiry and kitchen timestamps are interpreted
using an outlet time zone. Completed-today metrics use transition events and a
half-open `[local midnight, next local midnight)` interval converted to UTC
by PostgreSQL; this stays correct over DST changes (23- and 25-hour days).
Orders without a recorded completion event do not become fabricated completions.

### Launch checks

- Verify every stored timezone in PostgreSQL via `AT TIME ZONE`.
- Validate the ICU/SQL supported timezone intersection in production.
- Test Asia/Kolkata, Asia/Muscat, America/New_York and DST boundaries with a
  deterministic clock, plus unsupported aliases and malformed identifiers.
- Verify the dashboard pulse, Service Counter, POS, and historic-order snapshots
  with an actual authorized outlet; a nonexistent outlet returns no rows.
- Never relax RLS or substitute UTC to conceal an unsupported saved zone.

### Database-write contract

Migration-owned stored timezone writes are constrained to identifiers from
`pg_timezone_names` (or `UTC`) containing a region delimiter and passing
an actual `AT TIME ZONE` conversion. Administrative SQL must not silently
introduce abbreviations like `PST` or browser-supported aliases.
