# Deployment target: Linux AMD64

Approved 2026-10-15. The server is **AMD64/x86_64**, not ARM64. Earlier Ampere hardware/OS sizing
and SQLite deployment instructions are superseded. No deployment has been performed by this plan.

## Verify before provisioning

Record `uname -m` (expected x86_64), OS/libc, CPU, RAM, disk/free space, Node/pnpm support,
network/firewall and the actual public domain. Do not assume a specific Ubuntu release or free-tier size.
Build native dependencies, including Sharp, in Linux AMD64 with compatible runtime libraries.

## Target layout

- Nginx with TLS in front of a private Next.js listener.
- PostgreSQL, Redis queue and Redis cache bound privately; no public 5432/6379 exposure.
- Independent systemd units for web, dispatcher and workers; deployed artifacts root-owned/read-only.
- Releases under `/opt/menuminute/releases/<sha>` with a `current` symlink (proposed convention).
- Secrets under `/etc/menuminute/`; runtime temp/cache directories explicitly writable.
- PostgreSQL/Redis persistence outside releases; uploaded production assets in R2.

Configure NoNewPrivileges and appropriate filesystem restrictions with explicitly allowed runtime
writes. A release directory writable by the app is not an immutable deployment. Test Next.js cache
paths before enabling read-only protection. Do not copy the superseded single SQLite systemd unit.

## Proxy and live updates

Preserve verified host/protocol headers, trust only the configured proxy chain, enforce request limits
and allow long-lived SSE responses with buffering/cache disabled on the authorized events route.
Set heartbeats/timeouts and graceful reload behavior. Never publicly cache private dashboards/events.

## Release gate

1. Compatible stable dependencies pinned; frozen install and Linux AMD64 build pass.
2. PostgreSQL migration/cutover and restore rehearsal pass on representative data.
3. Separate Redis policy/persistence checks and queue-loss recovery pass.
4. Tenant/session/guest capability and ordering failure tests pass.
5. Backups, external alerts, SLO/RPO/RTO and operator escalation are configured and verified.
6. Run immutable artifact health checks before traffic; retain an explicitly compatible rollback.

Actual service units, resource limits, domains and commands belong in the implementation/provisioning
PR after discovery. This guide deliberately contains no guessed production hosts or secrets.
