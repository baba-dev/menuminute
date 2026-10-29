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
    getSystemHealth(actor),
    listUsers({ limit: 1 }),
    listOrganizations(actor, { limit: 1 }),
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
          <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
            Platform Command Center
          </h1>
          <p className="mt-1 text-xs text-stone-600 dark:text-stone-400">
            Real-time telemetry, identity authority, tenancy boundaries, and system queues.
          </p>
        </div>

        {/* Global System Health Badge */}
        <div className="flex items-center gap-2 rounded-xl border border-stone-200/90 bg-white px-4 py-2 text-xs shadow-xs dark:border-stone-800 dark:bg-stone-900">
          <div className="flex items-center gap-1.5">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                dbOk && redisQueueOk && redisCacheOk && failedJobsCount === 0
                  ? "animate-pulse bg-emerald-500 shadow-xs shadow-emerald-500/50"
                  : "animate-pulse bg-amber-500"
              }`}
            />
            <span className="font-semibold text-stone-800 dark:text-stone-200">
              {dbOk && redisQueueOk && redisCacheOk && failedJobsCount === 0
                ? "All Systems Operational"
                : "Attention Required"}
            </span>
          </div>
          <span className="text-stone-300 dark:text-stone-700">|</span>
          <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
            {systemHealth.database.latencyMs}ms DB
          </span>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Users Card */}
        <Link
          href="/admin/users"
          className="admin-card group p-5 transition hover:border-brand-500/50 dark:hover:border-brand-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Total Accounts
            </span>
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/60 dark:text-blue-400">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-display text-3xl font-extrabold tabular-nums text-stone-900 dark:text-stone-100">
              {usersData.total}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 group-hover:underline">
              Manage Users <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Organizations Card */}
        <Link
          href="/admin/organizations"
          className="admin-card group p-5 transition hover:border-brand-500/50 dark:hover:border-brand-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Tenants & Orgs
            </span>
            <div className="rounded-lg border border-purple-200 bg-purple-50 p-2 text-purple-700 dark:border-purple-900/60 dark:bg-purple-950/60 dark:text-purple-400">
              <Building2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="font-display text-3xl font-extrabold tabular-nums text-stone-900 dark:text-stone-100">
              {orgsData.total}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-semibold text-purple-600 dark:text-purple-400 group-hover:underline">
              Inspect Orgs <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </Link>

        {/* Outbox Queue Backlog Card */}
        <Link
          href="/admin/system"
          className="admin-card group p-5 transition hover:border-brand-500/50 dark:hover:border-brand-500/50"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Outbox Backlog
            </span>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-400">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="font-display text-3xl font-extrabold tabular-nums text-stone-900 dark:text-stone-100">
                {pendingJobsCount}
              </span>
              <span className="ml-2 text-xs text-stone-500 dark:text-stone-400">pending</span>
            </div>
            {failedJobsCount > 0 ? (
              <span className="admin-badge admin-badge-danger animate-pulse">
                {failedJobsCount} failed
              </span>
            ) : (
              <span className="admin-badge admin-badge-success">
                <CheckCircle2 className="h-3 w-3" /> Healthy
              </span>
            )}
          </div>
        </Link>

        {/* System Infra Card */}
        <div className="admin-card p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wider text-stone-500 dark:text-stone-400 uppercase">
              Core Services
            </span>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-400">
              <Activity className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">PostgreSQL</span>
              <span className="flex items-center gap-1 font-semibold text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-3 w-3" /> {systemHealth.database.latencyMs}ms
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-stone-600 dark:text-stone-400">Redis (Queue/Cache)</span>
              <span className="font-medium text-stone-800 dark:text-stone-200">
                {redisQueueOk ? "Q: OK" : "Q: OFF"} • {redisCacheOk ? "C: OK" : "C: OFF"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Middle Section: Quick Jump Grid & Telemetry Breakdown */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Runtime Environment Specs */}
        <div className="admin-card p-5 lg:col-span-1">
          <div className="flex items-center gap-2 border-b border-stone-200 pb-3 dark:border-stone-800">
            <Cpu className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            <h2 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
              Runtime Environment
            </h2>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between border-b border-stone-100 pb-2 dark:border-stone-800/60">
              <span className="text-stone-500 dark:text-stone-400">Node.js Engine</span>
              <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                {systemHealth.runtime.nodeVersion}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-2 dark:border-stone-800/60">
              <span className="text-stone-500 dark:text-stone-400">OS Architecture</span>
              <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                {systemHealth.runtime.platform} ({systemHealth.runtime.arch})
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-2 dark:border-stone-800/60">
              <span className="text-stone-500 dark:text-stone-400">Email Delivery Provider</span>
              <span className="font-mono font-bold uppercase text-orange-600 dark:text-orange-400">
                {systemHealth.runtime.emailProvider}
              </span>
            </div>
            <div className="flex justify-between border-b border-stone-100 pb-2 dark:border-stone-800/60">
              <span className="text-stone-500 dark:text-stone-400">Database Pool Size</span>
              <span className="font-mono font-medium text-stone-800 dark:text-stone-200">
                {systemHealth.database.poolMax} connections
              </span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-stone-500 dark:text-stone-400">AI Features Enabled</span>
              <span
                className={`font-semibold ${
                  systemHealth.runtime.aiFeaturesEnabled
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-stone-400 dark:text-stone-500"
                }`}
              >
                {systemHealth.runtime.aiFeaturesEnabled ? "Active" : "Disabled"}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Admin Audit Activity Feed */}
        <div className="admin-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <h2 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
                Recent Operator Activity
              </h2>
            </div>
            <Link
              href="/admin/security"
              className="text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300"
            >
              View Full Audit Trail &rarr;
            </Link>
          </div>

          <div className="mt-4 divide-y divide-stone-100 dark:divide-stone-800/60">
            {recentAudits.logs.length === 0 ? (
              <p className="py-6 text-center text-xs text-stone-500 dark:text-stone-400">
                No administrative actions recorded yet. All operator activity is immutably logged here.
              </p>
            ) : (
              recentAudits.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2.5 text-xs">
                  <div>
                    <span className="font-mono font-semibold text-orange-600 dark:text-orange-400">
                      {log.action}
                    </span>
                    <span className="ml-2 text-stone-600 dark:text-stone-400">
                      on <span className="font-medium text-stone-800 dark:text-stone-300">{log.targetType}</span>{" "}
                      {log.targetId ? `(${log.targetId.slice(0, 8)}...)` : ""}
                    </span>
                    <p className="text-[10px] text-stone-400 dark:text-stone-500">by {log.actorEmail}</p>
                  </div>
                  <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
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
