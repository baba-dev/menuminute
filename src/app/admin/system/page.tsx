import { verifySuperAdmin } from "@/lib/admin-guard";
import {
  getSystemHealth,
  listFailedOutboxEvents,
  listDomainProjections,
  retryOutboxEvent,
} from "@/modules/admin/system.service";
import { SystemConsole } from "./system-console";
import { Database, Activity, Layers, CheckCircle2, XCircle, GitBranch } from "lucide-react";
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
    { label: "Pending", count: health.outbox.counts["pending"] || 0, color: "text-amber-400" },
    { label: "Dispatched", count: health.outbox.counts["dispatched"] || 0, color: "text-blue-400" },
    {
      label: "Completed",
      count: health.outbox.counts["completed"] || 0,
      color: "text-emerald-400",
    },
    { label: "Failed", count: health.outbox.counts["failed"] || 0, color: "text-red-400" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          System Infrastructure & Queues
        </h1>
        <p className="text-xs text-stone-400">
          Telemetry, PostgreSQL connection pool, Redis workloads, outbox state, and domain
          projections.
        </p>
      </div>

      {/* Connectivity & Workload Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* PostgreSQL Pool */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
              PostgreSQL Data Plane
            </span>
            <Database className="h-4 w-4 text-blue-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Status</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-400 capitalize">
                <CheckCircle2 className="h-3 w-3" /> {health.database.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Ping Latency</span>
              <span className="font-mono text-stone-200">{health.database.latencyMs} ms</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Max Connection Pool</span>
              <span className="font-mono text-stone-200">
                {health.database.poolMax} connections
              </span>
            </div>
          </div>
        </div>

        {/* Redis Workloads */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
              Redis Workloads
            </span>
            <Activity className="h-4 w-4 text-orange-400" />
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Queue Redis</span>
              <span
                className={`flex items-center gap-1 font-semibold ${
                  health.redis.queue ? "text-emerald-400" : "text-red-400"
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
              <span className="text-stone-400">Cache Redis</span>
              <span
                className={`flex items-center gap-1 font-semibold ${
                  health.redis.cache ? "text-emerald-400" : "text-red-400"
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
              <span className="text-stone-400">Separation Policy</span>
              <span className="font-mono text-[11px] text-stone-300">Enforced Isolated</span>
            </div>
          </div>
        </div>

        {/* Outbox Overview */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <span className="text-xs font-semibold tracking-wider text-stone-400 uppercase">
              Outbox Event Pipeline
            </span>
            <Layers className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            {outboxStatuses.map((st) => (
              <div
                key={st.label}
                className="rounded-lg border border-stone-800 bg-stone-950/60 p-2"
              >
                <span className="block text-[10px] text-stone-500 uppercase">{st.label}</span>
                <span className={`text-base font-extrabold ${st.color}`}>{st.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dead-Letter / Failed Outbox Events Manager */}
      <SystemConsole failedEvents={failedEvents} onRetryAction={handleRetry} />

      {/* Domain Projections Freshness */}
      <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
        <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
          <GitBranch className="h-4 w-4 text-purple-400" />
          <h2 className="text-sm font-bold text-white">Domain Projections & Aggregate Versions</h2>
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs text-stone-300">
            <thead className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
              <tr>
                <th className="p-3">Organization</th>
                <th className="p-3">Org ID</th>
                <th className="p-3">Aggregate Version</th>
                <th className="p-3">Last Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-800/60 font-mono text-[11px]">
              {projections.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center font-sans text-stone-500">
                    No domain projection rows recorded.
                  </td>
                </tr>
              ) : (
                projections.map((p) => (
                  <tr key={p.organization_id} className="hover:bg-stone-800/40">
                    <td className="p-3 font-sans font-semibold text-white">{p.org_name}</td>
                    <td className="p-3 text-stone-400">{p.organization_id}</td>
                    <td className="p-3 font-bold text-purple-400">v{p.version}</td>
                    <td className="p-3 font-sans text-stone-400">
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
