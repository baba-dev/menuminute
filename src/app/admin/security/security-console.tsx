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
      <div className="flex border-b border-stone-800 text-xs font-semibold">
        <button
          onClick={() => setActiveTab("audits")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "audits"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          Administrative Audit Trail ({totalLogs})
        </button>
        <button
          onClick={() => setActiveTab("ratelimits")}
          className={`border-b-2 px-4 py-2.5 transition ${
            activeTab === "ratelimits"
              ? "border-orange-500 text-orange-400"
              : "border-transparent text-stone-400 hover:text-stone-200"
          }`}
        >
          Active Rate Limits ({rateLimits.length})
        </button>
      </div>

      {message && (
        <div
          className={`rounded-lg p-3 text-xs font-medium ${
            message.type === "success"
              ? "border border-emerald-800 bg-emerald-950 text-emerald-300"
              : "border border-red-800 bg-red-950 text-red-300"
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
              <h2 className="text-sm font-bold text-white">Platform Administrative Audit Trail</h2>
              <p className="text-xs text-stone-400">
                Tamper-evident log of all operator interventions, grants, session revocations, and
                status edits.
              </p>
            </div>
            <button
              onClick={() => router.refresh()}
              className="flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs text-stone-200 hover:bg-stone-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
                  <tr>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3">Operator</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Target</th>
                    <th className="p-3">IP Address</th>
                    <th className="p-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-sans text-xs">
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-stone-500">
                        No admin actions recorded yet.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => {
                      const isExpanded = expandedLogId === log.id;
                      return (
                        <tr key={log.id} className="hover:bg-stone-800/40">
                          <td className="p-3 font-mono text-[11px] whitespace-nowrap text-stone-400">
                            {new Date(log.createdAt).toLocaleString()}
                          </td>
                          <td className="p-3 font-mono text-stone-200">{log.actorEmail}</td>
                          <td className="p-3 font-mono font-bold text-orange-400">{log.action}</td>
                          <td className="p-3">
                            <span className="font-semibold text-white">{log.targetType}</span>
                            {log.targetId && (
                              <span className="ml-1 font-mono text-[10px] text-stone-500">
                                ({log.targetId.slice(0, 8)}...)
                              </span>
                            )}
                          </td>
                          <td className="p-3 font-mono text-[11px] text-stone-400">
                            {log.ipAddress || "—"}
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                              className="inline-flex items-center gap-1 rounded bg-stone-800 px-2 py-0.5 font-mono text-[10px] text-stone-300 hover:bg-stone-700"
                            >
                              <span>{isExpanded ? "Hide" : "Inspect"}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3 w-3" />
                              ) : (
                                <ChevronDown className="h-3 w-3" />
                              )}
                            </button>
                            {isExpanded && (
                              <div className="mt-2 max-w-sm overflow-x-auto rounded border border-stone-800 bg-stone-950 p-3 text-left font-mono text-[10px] text-stone-300">
                                <pre>{JSON.stringify(log.details, null, 2)}</pre>
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
              <h2 className="text-sm font-bold text-white">Active Rate Limit Keys</h2>
              <p className="text-xs text-stone-400">
                Throttled endpoints and client identifiers stored in PostgreSQL rate limits table.
              </p>
            </div>
            <button
              onClick={() => router.refresh()}
              className="flex items-center gap-1 rounded-lg border border-stone-700 bg-stone-800 px-3 py-1.5 text-xs text-stone-200 hover:bg-stone-700"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
          </div>

          <div className="rounded-2xl border border-stone-800 bg-stone-900 p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-stone-300">
                <thead className="border-b border-stone-800 bg-stone-950/50 text-[11px] font-semibold tracking-wider text-stone-400 uppercase">
                  <tr>
                    <th className="p-3">Rate Limit Key</th>
                    <th className="p-3">Hit Count</th>
                    <th className="p-3">Last Request Instant</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-800/60 font-mono text-xs">
                  {rateLimits.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center font-sans text-stone-500">
                        No active rate limits recorded.
                      </td>
                    </tr>
                  ) : (
                    rateLimits.map((rl) => (
                      <tr key={rl.id} className="hover:bg-stone-800/40">
                        <td className="p-3 font-semibold break-all text-orange-400">{rl.key}</td>
                        <td className="p-3 text-stone-200">{rl.count}</td>
                        <td className="p-3 text-[11px] text-stone-400">
                          {new Date(Number(rl.lastRequest)).toLocaleString()}
                        </td>
                        <td className="p-3 text-right font-sans">
                          <button
                            onClick={() => handleClear(rl.key)}
                            disabled={clearingKey === rl.key}
                            className="inline-flex items-center gap-1 rounded border border-red-800 bg-red-950/60 px-2.5 py-1 text-[11px] font-semibold text-red-400 hover:bg-red-900 disabled:opacity-50"
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
