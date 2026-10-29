import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  getSystemHealth,
  listFailedOutboxEvents,
  listDomainProjections,
  retryOutboxEvent,
} from "@/modules/admin/system.service";
import { SystemConsole } from "./system-console";
import {
  Database,
  Activity,
  Layers,
  CheckCircle2,
  XCircle,
  GitBranch,
  Gauge,
  Zap,
  Server,
} from "lucide-react";
import { revalidatePath } from "next/cache";

export default async function AdminSystemPage() {
  const actor = await verifySuperAdmin();
  const [health, failedEvents, projections] = await Promise.all([
    getSystemHealth(actor),
    listFailedOutboxEvents(actor, 50),
    listDomainProjections(actor, 20),
  ]);

  async function handleRetry(eventId: string) {
    "use server";
    const currentActor = await verifySuperAdmin();
    try {
      await retryOutboxEvent(currentActor, eventId);
      revalidatePath("/admin/system");
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  const outboxStatuses = [
    {
      label: "Pending",
      count: health.outbox.counts["pending"] || 0,
      textColor: "text-amber-600 dark:text-amber-400",
      badgeColor: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-900/60",
    },
    {
      label: "Dispatched",
      count: health.outbox.counts["dispatched"] || 0,
      textColor: "text-blue-600 dark:text-blue-400",
      badgeColor: "bg-blue-50 dark:bg-blue-950/60 border-blue-200 dark:border-blue-900/60",
    },
    {
      label: "Completed",
      count: health.outbox.counts["completed"] || 0,
      textColor: "text-emerald-600 dark:text-emerald-400",
      badgeColor: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-900/60",
    },
    {
      label: "Failed",
      count: health.outbox.counts["failed"] || 0,
      textColor: "text-red-600 dark:text-red-400",
      badgeColor: "bg-red-50 dark:bg-red-950/60 border-red-200 dark:border-red-900/60",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
          System Infrastructure & Queues
        </h1>
        <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
          Telemetry percentiles, PostgreSQL pool status, Redis workloads, outbox state machine, and domain aggregate versions.
        </p>
      </div>

      {/* Live Telemetry & Latency Registry */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Latency Percentiles */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Latency (5-min sample)
            </span>
            <Gauge className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">p50 Latency</span>
              <span className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">{health.telemetry.p50Ms} ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">p95 Latency</span>
              <span className="font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">{health.telemetry.p95Ms} ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">p99 Latency</span>
              <span className="font-mono font-bold tabular-nums text-rose-600 dark:text-rose-400">{health.telemetry.p99Ms} ms</span>
            </div>
          </div>
        </div>

        {/* Public Menu Cache Efficiency */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Redis Menu Cache
            </span>
            <Zap className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Hit Ratio</span>
              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{health.telemetry.cacheHitRatio}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Hits / Misses</span>
              <span className="font-mono font-medium tabular-nums text-stone-800 dark:text-stone-200">
                {health.telemetry.cacheHits} / {health.telemetry.cacheMisses}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Strategy</span>
              <span className="font-mono text-[11px] font-semibold text-stone-700 dark:text-stone-300">Atomic Lua Fence</span>
            </div>
          </div>
        </div>

        {/* Traffic & Status Distribution */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Traffic & Errors
            </span>
            <Activity className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Recorded Requests (process)</span>
              <span className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">{health.telemetry.requestsTotal}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Status 2xx / 4xx / 5xx</span>
              <span className="font-mono font-medium tabular-nums text-stone-800 dark:text-stone-200">
                <span className="text-emerald-600 dark:text-emerald-400">{health.telemetry.statusCodes["2xx"]}</span> /{" "}
                <span className="text-amber-600 dark:text-amber-400">{health.telemetry.statusCodes["4xx"]}</span> /{" "}
                <span className="text-rose-600 dark:text-rose-400">{health.telemetry.statusCodes["5xx"]}</span>
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Slow (&gt;250ms)</span>
              <span className="font-mono font-bold tabular-nums text-amber-600 dark:text-amber-400">{health.telemetry.slowRequests}</span>
            </div>
          </div>
        </div>

        {/* Node.js Runtime Memory & Uptime */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Process Memory & Uptime
            </span>
            <Server className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Heap Used</span>
              <span className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">{health.telemetry.memoryUsage.heapUsedMb} MB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Process RSS</span>
              <span className="font-mono font-bold tabular-nums text-stone-900 dark:text-stone-100">{health.telemetry.memoryUsage.rssMb} MB</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Process Uptime</span>
              <span className="font-mono font-medium text-stone-800 dark:text-stone-300">{Math.floor(health.telemetry.uptimeSeconds / 60)} min</span>
            </div>
          </div>
        </div>
      </div>

      {/* Read-only, process-local diagnostic signals */}
      <div className="admin-card p-4 text-xs text-stone-600 dark:text-stone-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-medium text-stone-700 dark:text-stone-300">
            Process telemetry · sampled last {health.telemetry.latencyWindowSeconds / 60} minutes ·{" "}
            {health.telemetry.latencySamples} latency samples
          </span>
          <span className="font-mono text-stone-500 dark:text-stone-400">Updated {new Date(health.telemetry.capturedAt).toLocaleString()}</span>
        </div>
        <p className="mt-2 text-stone-500 dark:text-stone-400">
          Total requests count only instrumented handlers plus legacy error paths and resets on
          restart. These counters are not host-wide.
        </p>
        {health.logger.dropped > 0 && (
          <p role="alert" className="mt-2 font-medium text-amber-600 dark:text-amber-400">
            Logging backpressure: {health.logger.dropped} lower-priority events dropped since
            process start.
          </p>
        )}
        {health.alerts.map((alert) => (
          <p
            key={alert.id}
            role="alert"
            className="mt-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
          >
            <strong>{alert.title}</strong> — {alert.explanation}
          </p>
        ))}
      </div>
      {/* Connectivity & Workload Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* PostgreSQL Pool */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              PostgreSQL Data Plane
            </span>
            <Database className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Status</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400 capitalize">
                <CheckCircle2 className="h-3 w-3" /> {health.database.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Ping Latency</span>
              <span className="font-mono font-medium tabular-nums text-stone-800 dark:text-stone-200">{health.database.latencyMs} ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Max Connection Pool</span>
              <span className="font-mono font-medium tabular-nums text-stone-800 dark:text-stone-200">
                {health.database.poolMax} connections
              </span>
            </div>
          </div>
        </div>

        {/* Redis Workloads */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Redis Workloads
            </span>
            <Activity className="h-4 w-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Queue Redis</span>
              <span
                className={`flex items-center gap-1 font-semibold ${
                  health.redis.queue ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {health.redis.queue ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" /> Disconnected
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Cache Redis</span>
              <span
                className={`flex items-center gap-1 font-semibold ${
                  health.redis.cache ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                }`}
              >
                {health.redis.cache ? (
                  <>
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3" /> Disconnected
                  </>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Separation Policy</span>
              <span className="font-mono text-[11px] font-semibold text-stone-700 dark:text-stone-300">Enforced Isolated</span>
            </div>
          </div>
        </div>

        {/* Outbox Overview */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Outbox Event Pipeline
            </span>
            <Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            {outboxStatuses.map((st) => (
              <div
                key={st.label}
                className={`rounded-lg border p-2 ${st.badgeColor}`}
              >
                <span className="block text-[10px] font-semibold text-stone-600 dark:text-stone-400 uppercase">{st.label}</span>
                <span className={`font-display text-base font-extrabold tabular-nums ${st.textColor}`}>{st.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dead-Letter / Failed Outbox Events Manager */}
      <SystemConsole failedEvents={failedEvents} onRetryAction={handleRetry} />

      {/* Domain Projections Freshness */}
      <div className="admin-card p-5">
        <div className="flex items-center gap-2 border-b border-stone-200 pb-3 dark:border-stone-800">
          <GitBranch className="h-4 w-4 text-purple-600 dark:text-purple-400" />
          <h2 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
            Domain Projections & Aggregate Versions
          </h2>
        </div>
        <div className="mt-4 admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th className="p-3">Organization</th>
                <th className="p-3">Org ID</th>
                <th className="p-3">Aggregate Version</th>
                <th className="p-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="font-mono text-[11px]">
              {projections.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center font-sans text-stone-500 dark:text-stone-400">
                    No domain projection rows recorded.
                  </td>
                </tr>
              ) : (
                projections.map((p) => (
                  <tr key={p.organization_id}>
                    <td className="p-3 font-sans font-semibold text-stone-900 dark:text-stone-100">{p.org_name}</td>
                    <td className="p-3 text-stone-500 dark:text-stone-400">{p.organization_id}</td>
                    <td className="p-3 font-bold text-purple-600 dark:text-purple-400">v{p.version}</td>
                    <td className="p-3 font-sans text-stone-500 dark:text-stone-400">
                      {new Date(p.updated_at).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
