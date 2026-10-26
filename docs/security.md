# Security model and launch gates

Status: target requirements, not a completed security audit.

## Implemented baseline and open gates

The current application uses Better Auth database sessions without cookie-cached authorization,
an explicit production secret, PostgreSQL tenant context/RLS and member-only outlet selection.
Provisioning is committed through a scoped database function after QR generation. API responses use
bounded request correlation IDs, and unexpected failures emit redacted structured events.

Public photo reads recheck active publication and approval on every request, use private ETag
revalidation, and are rate-limited through cache Redis. Production Nginx must overwrite forwarded
client identity headers and keep the application listener private. External error aggregation,
alert delivery, load/capacity evidence, recovery drills and a reviewed retention policy remain open
launch gates; repository controls are not evidence that those operator gates passed.

## Trust boundaries

- Browser, public QR URL, imported menu file, external API output and queue payload are untrusted.
- Resolve identities and current outlet memberships on the server; authorize every service operation.
- Better Auth database sessions support revocation; protected mutations also require origin/CSRF
  protection. Audit OAuth linking, invitation acceptance, account recovery and admin escalation.
- Use PostgreSQL RLS and composite tenant constraints as defense in depth, not substitutes for policy.
- Public QR tokens identify tables, not diner identity or physical presence. Staff acceptance limits
  impact; rate limits and opaque tracking capabilities prevent enumeration and trivial replay.

## Controls to implement

- Deny missing production secrets/configuration; separate dev/test seeds from production.
- Explicit trusted origins/hosts and proxy chain. Do not trust arbitrary forwarded IP headers.
- Secure HttpOnly session cookies, suitable SameSite, TLS, CSP and output escaping.
- MFA policy for owner/admin operations and verified enrollment/recovery; test all enabled sign-in
  paths because a plugin's presence alone does not enforce MFA everywhere.
- Redis/PostgreSQL private listeners, least-privilege credentials and encrypted off-host connections.
- Layered endpoint/session/tenant/IP limits. Challenge suspicious writes; no challenge on normal menu
  browsing. Specify outage policy per operation rather than global fail-open.
- Upload size/pixel/type limits, safe decode/re-encode, private originals and controlled publication.
  Remote imports must prevent SSRF, including redirects/private destinations and DNS re-resolution.
- Tenant-scoped R2 paths and authorized asset lookup; never trust an arbitrary object key.
- Minimize customer data; define retention, access and deletion rules before launch. Preserve necessary
  order audit history without retaining unnecessary personal data.
- Redact cookies, tokens, provider keys, passwords and customer notes from logs/error reporting.
- Audit membership, pricing, entitlements, acceptance, payment marking and administrative actions.

## Evidence

Cross-tenant ID swapping through reads/writes, joins, uploads, jobs, caches and live subscriptions;
revocation on existing SSE streams; pooled database context leakage; CSRF and origin checks; forged QR
bindings; brute force; oversized media; unsafe remote URLs; expired capabilities and safe error output.
A green unit suite is not a penetration test or proof of compliance.
