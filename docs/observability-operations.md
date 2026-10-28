# MenuMinute Observability 2.0 — operator runbook

The application web and worker accounts NEVER execute journalctl. An optional
non-login collector reads only two approved journal units and creates a sanitized,
bounded local log index. The admin UI fails closed and reports "collector unavailable"
until the collector is explicitly installed.

## Deployment / ownership

1. Confirm current release is healthy, out-of-band backup/restore and ERP protections.
2. Review \`infra/log-collector/collector.mjs\` and its allowlisted unit names.
3. As a host operator, create non-login user \`menuminute-logreader\` with primary
   group \`menuminute\` and supplementary \`systemd-journal\` (no shell or sudo).
   This supplementary group provides broad host journal read capability at the OS
   layer: treat this as a privileged, isolated service. Never assign it to web or worker.
4. Create \`/var/lib/menuminute/log-index\`, owned by
   \`menuminute-logreader:menuminute\` mode 0750. Set default index files to 0640.
5. Install the reviewed \`infra/systemd/menuminute-log-collector.service\`
   as a root-owned service under \`/etc/systemd/system\`.
6. Confirm the immutable release package contains `infra/log-collector/collector.mjs` and the collector unit, then deploy the audited artifact. Then \`systemctl daemon-reload\`,
   \`systemctl enable --now menuminute-log-collector.service\`.
7. Check \`systemctl status menuminute-log-collector.service\` and
   \`journalctl -u menuminute-log-collector.service --since -10min\`.
8. Confirm the web account can READ (but cannot WRITE) files in the index.
   It must not acquire systemd-journal group membership.
9. Run 5xx/worker smoke tests and verify admin-only access to /admin/logs.

**Important:** log collection is opt-in. Do not install the unit automatically
from a GitHub build; the host operator must authorize journal privileges.
The collector is intentionally read-only with respect to source journal entries.
It _does_ write a sanitized local index. Preserve system-level journald disk limits
separately; 256 MiB is the maximum for this application index, not host journal.
Inspect host journal retention and disk budget independently.

If the collector is stopped or old raw logs contain credentials, delete or
restrict only the sanitized index under operator supervision; never delete
the primary audit tables. Existing unstructured historical logs are not imported.

## Incident response

- Use the admin viewer for routine errors; it exposes no raw headers, request
  bodies, exception stacks, and no other service's logs.
- Admin viewer access requires superadmin and enrolled MFA.
- Treat anything in an exported diagnostic bundle as sensitive and log its access.
- Persistent operational log index retention: maximum 14 days / 256 MiB.
- Existing transactional audit records have independent retention and are not
  subject to index rotation.
- If index health becomes stale or an index file is unreadable, viewer reports
  unavailable, not "no errors". Review collector service status.
- Never disable migration, deployment, or shared ERP guards to install observability.
