import { verifySuperAdmin } from "@/lib/admin-guard";
import { getSystemHealth } from "@/modules/admin/system.service";
import { listUsers } from "@/modules/admin/users.service";
import { listOrganizations } from "@/modules/admin/tenancy.service";
import { listAdminAuditLogs } from "@/modules/admin/security.service";
import Link from "next/link";
import {
  Users,
  Building2,
  Activity,
  Layers,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  Cpu,
} from "lucide-react";

export default async function AdminOverviewPage() {
  const actor = await verifySuperAdmin();

  const [systemHealth, usersData, orgsData, recentAudits] = await Promise.all([
    getSystemHealth(),
    listUsers({ limit: 1 }),
    listOrganizations({ limit: 1 }),
    listAdminAuditLogs(actor, { limit: 5 }),
  ]);

  const dbOk = systemHealth.database.status === "healthy";
  const redisQueueOk = systemHealth.redis.queue;
  const redisCacheOk = systemHealth.redis.cache;
  const failedJobsCount = systemHealth.outbox.counts["failed"] || 0;
  const pendingJobsCount = systemHealth.outbox.counts["pending"] || 0;

  return (
    <div className="space-y-6">
      {/* Top Welcome & Health Banner */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Platform Command Center</h1>
          <p className="text-xs text-stone-400">
            Real-time telemetry, identity control, billing authority, and system queues.
          </p>
        </div>

        {/* Global System Health Badge */}
        <div className="flex items-center gap-2 rounded-xl border border-stone-800 bg-stone-900 px-4 py-2 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                dbOk && redisQueueOk && redisCacheOk && failedJobsCount === 0
                  ? "bg-emerald-500 shadow-sm shadow-emerald-500 animate-pulse"
                  : "bg-amber-500 animate-pulse"
              }`}
            />
            <span className="font-semibold text-stone-200">
              {dbOk && redisQueueOk && redisCacheOk && failedJobsCount === 0
                ? "All Systems Operational"
                : "Attention Required"}
            </span>
          </div>
          <span className="text-stone-600">|</span>
          <span className="text-stone-400 font-mono text-[11px]">{systemHealth.database.latencyMs}ms DB</span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Users Card */}
        <Link
          href="/admin/users"
          className="group rounded-2xl border border-stone-800 bg-stone-900/80 p-5 transition hover:border-stone-700 hover:bg-stone-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Total Accounts
            </span>
            <div className="rounded-lg bg-blue-950/60 p-2 text-blue-400 border border-blue-900">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{usersData.total}</span>
            <span className="flex items-center gap-1 text-[11px] text-blue-400 group-hover:underline">
              Manage Users <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Organizations Card */}
        <Link
          href="/admin/organizations"
          className="group rounded-2xl border border-stone-800 bg-stone-900/80 p-5 transition hover:border-stone-700 hover:bg-stone-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Tenants & Orgs
            </span>
            <div className="rounded-lg bg-purple-950/60 p-2 text-purple-400 border border-purple-900">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold text-white">{orgsData.total}</span>
            <span className="flex items-center gap-1 text-[11px] text-purple-400 group-hover:underline">
              Inspect Orgs <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Outbox Queue Backlog Card */}
        <Link
          href="/admin/system"
          className="group rounded-2xl border border-stone-800 bg-stone-900/80 p-5 transition hover:border-stone-700 hover:bg-stone-900"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Outbox Backlog
            </span>
            <div className="rounded-lg bg-amber-950/60 p-2 text-amber-400 border border-amber-900">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-white">{pendingJobsCount}</span>
              <span className="ml-2 text-xs text-stone-400">pending</span>
            </div>
            {failedJobsCount > 0 ? (
              <span className="rounded bg-red-950 px-2 py-0.5 text-[10px] font-bold text-red-400 border border-red-800 animate-pulse">
                {failedJobsCount} failed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> Healthy
              </span>
            )}
          </div>
        </Link>

        {/* System Infra Card */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900/80 p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">
              Core Services
            </span>
            <div className="rounded-lg bg-emerald-950/60 p-2 text-emerald-400 border border-emerald-900">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-400">PostgreSQL</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> {systemHealth.database.latencyMs}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-400">Redis (Queue/Cache)</span>
              <span className="font-semibold text-stone-300">
                {redisQueueOk ? "Q: OK" : "Q: OFF"} • {redisCacheOk ? "C: OK" : "C: OFF"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Quick Jump Grid & Telemetry Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Runtime Environment Specs */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
            <Cpu className="h-4 w-4 text-orange-500" />
            <h2 className="text-sm font-bold text-white">Runtime Environment</h2>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between border-b border-stone-800/60 pb-2">
              <span className="text-stone-400">Node.js Engine</span>
              <span className="font-mono text-stone-200">{systemHealth.runtime.nodeVersion}</span>
            </div>
            <div className="flex justify-between border-b border-stone-800/60 pb-2">
              <span className="text-stone-400">OS Architecture</span>
              <span className="font-mono text-stone-200">
                {systemHealth.runtime.platform} ({systemHealth.runtime.arch})
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-800/60 pb-2">
              <span className="text-stone-400">Email Delivery Provider</span>
              <span className="font-mono text-orange-400 uppercase font-semibold">
                {systemHealth.runtime.emailProvider}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-800/60 pb-2">
              <span className="text-stone-400">Database Pool Size</span>
              <span className="font-mono text-stone-200">{systemHealth.database.poolMax} connections</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-stone-400">AI Features Enabled</span>
              <span
                className={`font-semibold ${
                  systemHealth.runtime.aiFeaturesEnabled ? "text-emerald-400" : "text-stone-500"
                }`}
              >
                {systemHealth.runtime.aiFeaturesEnabled ? "Active" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Admin Audit Activity Feed */}
        <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Recent Operator Activity</h2>
            </div>
            <Link
              href="/admin/security"
              className="text-xs text-orange-400 hover:text-orange-300 font-semibold"
            >
              View Full Audit Trail &rarr;
            </Link>
          </div>

          <div className="mt-4 divide-y divide-stone-800/60">
            {recentAudits.logs.length === 0 ? (
              <p className="py-6 text-center text-xs text-stone-500">
                No administrative actions recorded yet. All operator activity is immutably logged here.
              </p>
            ) : (
              recentAudits.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-mono font-semibold text-orange-400">{log.action}</span>
                    <span className="ml-2 text-stone-400">
                      on <span className="text-stone-300 font-medium">{log.targetType}</span>{" "}
                      {log.targetId ? `(${log.targetId.slice(0, 8)}...)` : ""}
                    </span>
                    <p className="text-[10px] text-stone-500">by {log.actorEmail}</p>
                  </div>
                  <span className="text-[11px] text-stone-400 font-mono">
                    {new Date(log.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
