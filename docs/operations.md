# Operations and recovery requirements

Status: operational design and future reliability targets. Initial MenuMinute web/worker services
were publicly activated with successful readiness and ERP coexistence on 2026-10-16; actual
installed paths, recovery snapshots and **outstanding** merchant-flow, nightly-backup and alert
verification are recorded in [the production runbook](production-runbook.md). Do not treat a
proposed timer, retention policy or incident response plan as verified installed behavior.

## Processes and resource budgets

Supervise web, outbox dispatcher and bounded-concurrency workers independently. Queue Redis uses
AOF/persistence with a documented fsync/loss tradeoff and noeviction. Cache Redis uses TTLs and an
explicit eviction policy. Both have separate memory budgets/credentials. PostgreSQL owns recovery
intent, so Redis restart/loss must be recoverable through durable work reconciliation.

Reserve host memory for PostgreSQL, Redis, OS and connection bursts. Set service memory limits,
worker concurrency and queue retention after peak ERP discovery and shared-host load testing.
Use the dated baseline in [server inventory](server-inventory.md); it is not a capacity guarantee. Build releases in external ARM64 CI rather than competing with the ERP on the production host.

## Degraded modes

| Failure                              | Behavior                                                                                                      |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| PostgreSQL unavailable               | New writes fail safely; preserve cart/key, show retryable state; no false acceptance                          |
| Queue Redis unavailable              | Persist outbox; alert; continue only within an agreed backlog/age threshold                                   |
| Cache Redis unavailable              | Bounded database fallback for reads; apply endpoint-specific write protection                                 |
| Distributed rate limiter unavailable | Auth/recovery sensitive operations fail closed or use a reviewed edge safeguard; local fallback is not global |
| Live signals unavailable             | KDS polling and authoritative resync; show connection status                                                  |
| AI/media/email unavailable           | Defer optional work; normal order lifecycle remains operational                                               |
| Disk or queue memory near limit      | Alert and shed nonessential work; never silently discard accepted orders                                      |

Define exact thresholds from launch SLOs and measured capacity; none are claimed as tested here.
Readiness may report degraded Redis without failing liveness or restarting healthy web processes.

## Metrics and alerts

Track accepted submission latency/error rate, pending restaurant acknowledgement age, oldest outbox
age, dispatched-but-incomplete work, failed retries, KDS last sync, pool wait/timeouts, PostgreSQL
locks/disk/WAL, Redis memory/evictions/persistence errors and worker heartbeat. Correlate request,
order, event and job IDs; avoid unbounded tenant labels in metrics.

External checks must detect host failure. Local-only monitoring fails with the same host.

## Backups and restoration

Use encrypted off-host PostgreSQL backups with verified retention and separate credentials. Add WAL
archiving/point-in-time recovery according to agreed RPO. A daily dump alone cannot promise zero
order loss. For the selected current deployment, **local** persistent media at `/var/lib/menuminute/media`
is captured with PostgreSQL and configuration using private encrypted R2/restic; no live R2 media
bucket is configured. Back up object metadata/provenance and plan media retention alongside database
retention. A sequential live pg_dump and media walk is not atomically consistent without an approved
write barrier or reconciled snapshot method; do not claim a tested RPO from it.

Restore drills must provision a clean isolated database, restore schema/data, verify counts and money,
reconcile pending work, test a menu/order/KDS flow and record elapsed recovery time. Disable external
side effects while replaying a restored environment. Redis backups are useful but never the only copy
of required work. Test logical recovery after accidental deletion as well as host loss.

## Release and rollback

Build one immutable ARM64 artifact in CI. Back up, apply compatible reviewed migrations under a lock,
start release, run readiness and synthetic nonbillable smoke checks, then switch traffic. Keep old assets
for rolling clients and coordinate Next.js deployment identity/shared cache when replicas arrive.
Drain workers and SSE gracefully on termination; leases/retries handle interrupted work.

Application rollback requires compatible schema. A schema/data restore after new orders requires an
explicit recovery plan, not simply switching a symlink. Do not replay paid/provider effects blindly.

## Launch decisions still required

Owner must select availability SLO, accepted data-loss window (RPO), recovery time (RTO), order/event
retention and escalation contacts before launch. Single-host deployment is not high availability.

## Initial workload and closing recovery

Plan for 25 owners, 50 restaurants/outlets and menus, 1,000 orders/hour aggregate; establish burst,
concurrent diner/staff/SSE and retention fixtures before sizing. Monitor pending acceptance/expiry,
reconcile overdue pending orders after outages, and test acceptance rejection after deadline even
without an expiry worker. See [product requirements](product-requirements.md). Growth remains
subject to resources and measured shared-host behavior, not a seamless-capacity promise.
