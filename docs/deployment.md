# Deployment target: Linux ARM64

The shared Oracle ERP host is **Linux ARM64/aarch64, 4 visible ARM cores and 23 GiB RAM**.
The earlier AMD64 host choice is superseded. **Initial production activation was verified on
2026-10-16**, not performed by this documentation change. For current confirmed paths, the initial
live artifact and outstanding production acceptance gates, read [the canonical production runbook](production-runbook.md)
before these general deployment contracts. Phase 1 implements PostgreSQL/Redis foundation
configuration; SQLite is read-only import input.

See [server inventory](server-inventory.md) for observations, confirmed cleanup and outstanding inputs.

## Verify before provisioning

Recheck `uname -m` (expected aarch64), OS/libc, free storage, resource pressure and ports. Confirm
OCI shape/region, security lists/NSGs, ERP peak load, ERP database dependencies, Node/pnpm versions
and the actual Food Minutes domain/TLS. At 2026-10-16 public activation the root had approximately 46 GB free; recheck before each release.

## Native ARM64 build contract

- Build/test on `ubuntu-24.04-arm` with Node 24 from `.nvmrc` and packageManager-pinned pnpm 11.
- Use `pnpm install --frozen-lockfile`; do not omit architecture-specific optional dependencies.
- Verify `process.platform` is linux and `process.arch` is arm64 before building. Cache keys include
  OS, architecture and Node major; never restore AMD64 node_modules or `.next` into ARM64 releases.
- Verify Next.js SWC, Sharp and any other native module installs and runtime loads on ARM64/glibc.
  The SQLite native package is development-only for explicit legacy import/tests.
- If container packaging is introduced, target `linux/arm64` with compatible base images and a
  native smoke test. A cross-compiled image or x64-only test is not native release evidence.
- Record commit/artifact SHA, architecture and toolchain. Produce one immutable release in external
  CI; do not run production builds or a self-hosted PR runner on the ERP machine.

Phase 1 CI runs PostgreSQL/Redis integration and standalone HTTPS browser checks on ARM64.
It does not deploy releases or prove shared-ERP capacity. See [foundation status](foundation/phase-1.md).

## Target layout and ERP isolation

- Share the existing Nginx entry point, using a separate approved domain/TLS virtual host.
- Keep ERP on port 3000; proposed Food Minutes listener is 127.0.0.1:3100, subject to a fresh port check.
- PostgreSQL, Redis queue and Redis cache bound privately; no public database/Redis exposure.
- Independent non-root systemd units for web, dispatcher and workers; separate credentials from ERP.
- Releases under `/var/www/menuminute/releases/<sha>` with `current` and `worker-current` symlinks (matching committed units),
  root-owned/read-only at runtime. Secrets under `/etc/menuminute/`.
- PostgreSQL/Redis persistence and **local private uploaded media** outside releases at
  `/var/lib/menuminute/media`; private Cloudflare R2 is used for encrypted restic backups only.
- Set tested resource limits and reserve ERP/OS capacity; see [operations](operations.md).

Use a private, root-owned Node 24 binary at `/opt/menuminute/node24/bin/node` for the
MenuMinute deploy helper, web unit, worker unit and migration runner. Do not replace
`/usr/bin/node`, which is used by the colocated ERP on Node 20. Review any installed
unit differences and the previous application's rollback compatibility before restart.

Configure NoNewPrivileges and appropriate filesystem restrictions with explicitly allowed runtime
writes. Test Next.js cache paths before read-only protection. Do not copy the superseded SQLite unit.
Preserve ERP services/data; harden its root-run app and wildcard listener only in a reviewed maintenance
change. Do not blindly update PM2 or flush CrowdSec/Docker rules. Check both IPv4 and IPv6 access,
including OCI rules, and preserve administrative recovery access before firewall changes.

## Proxy and live updates

Preserve verified host/protocol headers, trust only the configured proxy chain, enforce request limits
and allow long-lived SSE responses with buffering/cache disabled on the authorized events route.
Set heartbeats/timeouts and graceful reload behavior. Never publicly cache private dashboards/events.
Validate Nginx configuration and verify ERP health before and after a reload.

## Release gate

1. Compatible stable dependencies pinned; frozen install, native Linux ARM64 tests/build and runtime checks pass.
2. PostgreSQL migration/cutover and restore rehearsal pass on representative data.
3. Separate Redis policy/persistence checks and queue-loss recovery pass.
4. Tenant/session/guest capability and ordering failure tests pass.
5. Joint ERP/Food Minutes peak-load checks pass with agreed resource limits and storage headroom.
6. Backups, external alerts, SLO/RPO/RTO and operator escalation are configured and verified.
7. Run immutable artifact health checks before traffic; retain an explicitly compatible rollback.

The actual installed systemd units, deployed SHA, production hostname and paths are recorded in
[the runbook](production-runbook.md). A new successful CI build or artifact publication never
authorizes a VPS cutover on its own.

## CI reference

[GitHub-hosted runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners)
lists `ubuntu-24.04-arm` as a native ARM64 runner. Verify availability when implementing release CI.

## Verified artifact -> VPS deployment

The four native CI lanes run in parallel, with a final aggregate gate. The
successful main run uploads the exact compiled/tested ARM64 release. The
publisher verifies the source run, checksum, embedded identity and main SHA;
it does not rebuild. Its authenticated handoff drives a separately reported
staging environment. Only a healthy migration-compatible candidate reaches
the `production` activation job with the native
[application link](https://food.bababuilds.com). Public readiness includes the
expected release identity. Migration-changing releases remain stage-only until
root-approved manual SQL migration and activation. Never use production database
credentials from GitHub Actions, update shared ERP services, or build on VPS.
See [Actions deployment](deployment-actions.md) and
[production runbook](production-runbook.md). This source-level behavior requires
a separately reviewed helper v2 installation and GitHub Environment configuration.
