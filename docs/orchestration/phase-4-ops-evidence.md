# Phase 4 operator-backed production acceptance

Parent #37 / A10 #49. Source baseline: accepted Phase 4 product changes on `main` as of 2026-10-17. **No production backup, data-restoration, off-host alert, or authenticated live merchant flow has been executed by this document.** A successful GitHub CI/deploy reports only the checks it actually runs. Record output without credentials, user information or raw database/media bytes.

## Read-only evidence capture (operator runs on host)

Capture dated console transcript or linked internal ticket with command statuses. These commands must not deploy, rotate keys, delete, restart or modify ERP.

```bash
date -Is
readlink -f /var/www/menuminute/current
readlink -f /var/www/menuminute/worker-current
systemctl is-active menuminute-web.service menuminute-worker.service
systemctl is-enabled menuminute-web.service menuminute-worker.service
curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3100/api/health/ready
curl --fail --silent --show-error --max-time 20 https://food.bababuilds.com/api/health/ready
curl --fail --silent --show-error --max-time 20 -o /dev/null -w 'ERP HTTP %{http_code}\n' https://erp.bababuilds.com/
systemctl list-timers --all 'menuminute*'
systemctl show menuminute-backup.service -p ActiveState -p Result -p ExecMainStatus -p ExecMainExitTimestamp
systemctl show menuminute-backup.timer -p ActiveState -p UnitFileState -p NextElapseUSecRealtime
df -h / /var/lib/menuminute/media
df -i / /var/lib/menuminute/media
```

Use `/usr/local/sbin/menuminute-restic snapshots` with the existing protected wrapper (do not print auth variables, backup credentials or `r2.json`). Document observed repository location, latest snapshot age, database and media payload presence, retention and exit status only. The existing runbook lists older snapshots; snapshot _existence_ alone is not a proven recovery point.

## Functional acceptance on a controlled test outlet

1. Create a fresh owner and dedicated disposable organization/outlet with supported non-default geography/currency. Record only test fixture identifiers in a private evidence store.
2. Create category/dish/variant/add-on/schedule. Confirm public token returns no draft content. Upload safe test image (JPEG/PNG/WebP under 5MiB/10MP); verify ownership/rights, private-original access denial, worker READY, manual approval, no guest image before explicit publish.
3. Publish and scan the permanent QR via actual guest device. Check identity, search/dietary/sold-out handling, approved media derivative, fallback URL and printed QR, then save a new draft; guests must still see previous release until next publish.
4. Verify token continuity across edits/rename/plan change and exact explicit revocation/regeneration semantics. Retest stale open guest page after 404/410 response.
5. Exercise owner/role revocation, cross-outlet/tenant denials. Observe error recovery rather than issuing live orders or any paid provider usage.
6. Record both MenuMinute services and ERP HTTP/readiness after tests. Remove only disposable fixtures using approved product controls and retention, not direct SQL deletion.

## Recovery and alert evidence gate

- Operator agrees consistent SQL+private-media snapshot strategy: PostgreSQL custom-format dump and filesystem traversal taken separately are not atomic. Define write barrier or proven reconciliation; do not invent an RPO/RTO.
- In **isolated disposable** resources, restore matching SQL _and_ media (plus safely provisioned application configuration/compatible SHA), rehydrate required PostgreSQL privileges, and prove draft/published/QR/media correctness. Never restore into live production and never run an unreviewed migration on production.
- Verify timer installation, next fire, successful recent service execution and nightly failure handling. Prove off-host alert delivery by approved non-destructive synthetic failure/test message; no secret material committed or shared to CI.
- Capture before/after CPU/RAM/disk/WAL and ERP health, with quantified thresholds and owner sign-off. Pass criteria depend on actual measured host usage, not an unmeasured scale assertion.

## Release evidence ledger

| Evidence                                                     | Status      | Required proof                                     |
| ------------------------------------------------------------ | ----------- | -------------------------------------------------- |
| Four ARM64 CI lanes + quality gate on _integrated final SHA_ | Pending     | Exact Actions URL, SHA and all conclusions         |
| Immutable artifact, checksum and exact public deployment SHA | Pending     | Publisher/deployer URL, links and public readiness |
| Unchanged migration guard / operator-only migration          | Pending     | Helper decision and migration-tree comparison      |
| ERP coexistence after release                                | Pending     | Actual ERP 200 and basic resource capture          |
| Authenticated owner/media/QR live smoke                      | Pending     | Controlled private evidence                        |
| Nightly backup + external alert                              | Unconfirmed | Host timer/journal and off-host alert receipt      |
| Isolated SQL + matching media restore                        | Unconfirmed | Dated successful disposable restore evidence       |
| Launch-readiness sign-off                                    | Blocked     | All above verified; no automatic closure           |

Manual and automatic activation must follow `docs/production-runbook.md` and `docs/deployment-actions.md`. Explicitly mark any unperformed item pending. A10 remains open until an authorized operator supplies verifiable evidence.
