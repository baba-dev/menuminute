"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

interface RateLimitRow {
  id: string;
  key: string;
  count: number;
  lastRequest: number;
}

interface AdminAuditRow {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetType: string;
  targetId: string | null;
  details: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string | Date;
}

interface SecurityConsoleProps {
  rateLimits: RateLimitRow[];
  auditLogs: AdminAuditRow[];
  totalLogs: number;
  onClearRateLimit: (key: string) => Promise<any>;
}

export function SecurityConsole({
  rateLimits,
  auditLogs,
  totalLogs,
  onClearRateLimit,
}: SecurityConsoleProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"audits" | "ratelimits">("audits");
  const [clearingKey, setClearingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  async function handleClear(key: string) {
    if (!confirm(`Are you sure you want to clear rate limit for key "${key}"?`)) return;
    setClearingKey(key);
    setMessage(null);
    try {
      await onClearRateLimit(key);
      setMessage({ text: `Rate limit key "${key}" cleared successfully.`, type: "success" });
      router.refresh();
    } catch (err: any) {
      setMessage({ text: err.message || "Failed to clear rate limit", type: "error" });
    } finally {
      setClearingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex border-b border-stone-200 text-xs font-semibold dark:border-stone-800">
        <button
          type="button"
          onClick={() => setActiveTab("audits")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "audits"
              ? "border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400"
              : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          Administrative Audit Trail ({totalLogs})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ratelimits")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "ratelimits"
              ? "border-orange-600 text-orange-600 dark:border-orange-400 dark:text-orange-400"
              : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          Active Rate Limits ({rateLimits.length})
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl border p-3 text-xs font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* ─── TAB 1: Audit Trail ────────────────────────────────────────────────────── */}
      {activeTab === "audits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                Platform Administrative Audit Trail
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Tamper-evident log of all operator interventions, grants, session revocations, and
                status edits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="admin-card p-5">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-sans text-xs dark:divide-stone-800">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-6 text-center text-stone-500 dark:text-stone-400"
                      >
                        No admin actions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      return (
                        <tr key={log.id}>
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap text-stone-500 dark:text-stone-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 font-mono text-stone-800 dark:text-stone-200">
                            {log.actorEmail}
                          </td>
                          <td className="p-3 font-mono font-bold text-orange-600 dark:text-orange-400">
                            {log.action}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold text-stone-900 dark:text-stone-100">
                              {log.targetType}
                            </span>
                            {log.targetId && (
                              <span className="ml-1 font-mono text-[10px] text-stone-400 dark:text-stone-500">
                                ({log.targetId.slice(0, 8)}...)
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-stone-500 dark:text-stone-400">
                            {log.ipAddress || "—"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              type="button"
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2 py-0.5 font-mono text-[10px] font-semibold text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
                            >
                              <span>{isExpanded ? "Hide" : "Inspect"}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="mt-2 max-w-sm overflow-x-auto rounded-xl border border-stone-200 bg-stone-50 p-3 text-left font-mono text-[10px] text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-300">
                                <pre className="whitespace-pre-wrap">
                                  {JSON.stringify(log.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 2: Rate Limits ────────────────────────────────────────────────────── */}
      {activeTab === "ratelimits" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-stone-900 dark:text-stone-100">
                Active Rate Limit Keys
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Throttled endpoints and client identifiers stored in PostgreSQL rate limits table.
              </p>
            </div>
            <button
              type="button"
              onClick={() => router.refresh()}
              className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="admin-card p-5">
            <div className="admin-table-container">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th className="p-3">Rate Limit Key</th>
                    <th className="p-3">Hit Count</th>
                    <th className="p-3">Last Request Instant</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200 font-mono text-xs dark:divide-stone-800">
                  {rateLimits.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="p-6 text-center font-sans text-stone-500 dark:text-stone-400"
                      >
                        No active rate limits recorded.
                      </td>
                    </tr>
                  ) : (
                    rateLimits.map((rl) => (
                      <tr key={rl.id}>
                        <td className="p-3 font-semibold break-all text-orange-600 dark:text-orange-400">
                          {rl.key}
                        </td>
                        <td className="p-3 font-bold text-stone-800 tabular-nums dark:text-stone-200">
                          {rl.count}
                        </td>
                        <td className="p-3 text-[11px] text-stone-500 dark:text-stone-400">
                          {new Date(Number(rl.lastRequest)).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-sans">
                          <button
                            type="button"
                            onClick={() => handleClear(rl.key)}
                            disabled={clearingKey === rl.key}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-300 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50 dark:border-red-800 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-900/60"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>{clearingKey === rl.key ? "Clearing..." : "Clear Key"}</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
