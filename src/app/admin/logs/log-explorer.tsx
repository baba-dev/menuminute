"use client";

import Link from "next/link";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle, ArrowDown, FileText, RefreshCw, Search, ShieldCheck, X } from "lucide-react";
import type { AdminLogEntry, AdminLogResult } from "@/modules/admin/logs.service";

const levelLabels = ["all", "debug", "info", "warn", "error", "fatal"] as const;
const serviceLabels = ["all", "web", "worker"] as const;

export function LogExplorer() {
  const [level, setLevel] = useState<string>("all");
  const [service, setService] = useState<string>("all");
  const [range, setRange] = useState("24h");
  const [search, setSearch] = useState("");
  const [live, setLive] = useState(false);
  const [pageCursor, setPageCursor] = useState<string | null>(null);
  const [result, setResult] = useState<AdminLogResult | null>(null);
  const [selected, setSelected] = useState<AdminLogEntry | null>(null);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const latestRequest = useRef(0);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++latestRequest.current;
      setLoading(true);
      setFailure(null);
      try {
        const q = new URLSearchParams({ range });
        if (level !== "all") q.set("level", level);
        if (service !== "all") q.set("service", service);
        if (search.trim()) q.set("search", search.trim().slice(0, 80));
        if (pageCursor) q.set("before", pageCursor);
        const response = await fetch("/api/admin/logs?" + q.toString(), {
          cache: "no-store",
          credentials: "same-origin",
          signal,
        });
        if (!response.ok) throw new Error("Log access unavailable (" + response.status + ")");
        const data = (await response.json()) as AdminLogResult;
        if (!signal?.aborted && requestId === latestRequest.current) setResult(data);
      } catch (error) {
        if (!signal?.aborted && requestId === latestRequest.current)
          setFailure(error instanceof Error ? error.message : "Unable to read logs");
      } finally {
        if (!signal?.aborted && requestId === latestRequest.current) setLoading(false);
      }
    },
    [level, service, range, search, pageCursor]
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void refresh(controller.signal);
    }, search ? 250 : 0);
    if (!live) {
      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    }
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") void refresh(controller.signal);
    }, 8000);
    return () => {
      clearTimeout(timer);
      controller.abort();
      clearInterval(interval);
    };
  }, [refresh, live, search]);

  const resetCursor = () => setPageCursor(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            <h1 className="font-display text-2xl font-bold tracking-tight text-stone-900 dark:text-stone-100 sm:text-3xl">
              Logs &amp; Diagnostics
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-xs text-stone-600 dark:text-stone-400">
            Read-only, sanitized MenuMinute web and worker events. Database audit records remain in Security &amp; Audits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200">
            <input
              type="checkbox"
              checked={live}
              onChange={(event) => setLive(event.target.checked)}
              className="accent-orange-600"
            />
            Live tail (8s)
          </label>
          <Link
            href="/account/security"
            title="Complete password and authenticator approval for exporting"
            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            Confirm access
          </Link>
          <button
            type="button"
            onClick={async () => {
              try {
                const response = await fetch("/api/admin/logs/export", {
                  method: "POST",
                  credentials: "same-origin",
                  headers: { "Content-Type": "application/json" },
                  body: "{}",
                });
                if (!response.ok)
                  throw new Error(
                    "Export requires a fresh password and authenticator confirmation"
                  );
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "menuminute-diagnostics.json";
                link.click();
                URL.revokeObjectURL(url);
              } catch (error) {
                setFailure(
                  error instanceof Error ? error.message : "Export unavailable"
                );
              }
            }}
            className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
          >
            Export 100
          </button>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex items-center gap-1.5 rounded-xl bg-orange-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs hover:bg-orange-500"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter toolbar */}
      <div className="admin-card p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
            Severity
            <select
              aria-label="Severity"
              value={level}
              onChange={(e) => {
                setLevel(e.target.value);
                resetCursor();
              }}
              className="admin-input mt-1"
            >
              {levelLabels.map((x) => (
                <option key={x} value={x}>
                  {x === "all" ? "All severities" : x.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
            Service
            <select
              aria-label="Service"
              value={service}
              onChange={(e) => {
                setService(e.target.value);
                resetCursor();
              }}
              className="admin-input mt-1"
            >
              {serviceLabels.map((x) => (
                <option key={x} value={x}>
                  {x === "all" ? "Both services" : x}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
            Time range
            <select
              aria-label="Time range"
              value={range}
              onChange={(e) => {
                setRange(e.target.value);
                resetCursor();
              }}
              className="admin-input mt-1"
            >
              {["1h", "24h", "7d", "14d"].map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-stone-600 dark:text-stone-400">
            Search
            <input
              aria-label="Search logs"
              maxLength={80}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                resetCursor();
              }}
              placeholder="Trace, error, route..."
              className="admin-input mt-1"
            />
          </label>
        </div>
      </div>

      {failure && (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {failure}
        </div>
      )}

      {result && !result.available && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
        >
          <AlertTriangle className="mr-2 inline h-4 w-4" />
          {result.reason}. No absence-of-errors claim can be made while collection is unavailable.
        </div>
      )}

      {result?.available && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span>
              <ShieldCheck className="mr-1 inline h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              Sanitized collector · {result.entries.length} displayed · {loading ? "Refreshing..." : "Snapshot"}
            </span>
            <span>
              Collected {new Date(result.collection?.capturedAt ?? result.capturedAt).toLocaleString()} ·{" "}
              {Math.round((result.collection?.bytes ?? 0) / 1048576)} MiB indexed
            </span>
          </div>

          <div className="admin-card overflow-hidden">
            <div className="divide-y divide-stone-200 dark:divide-stone-800">
              {result.entries.map((entry, i) => (
                <button
                  type="button"
                  key={entry.timestamp + "-" + i}
                  onClick={() => setSelected(entry)}
                  className="grid w-full gap-2 px-4 py-3 text-left transition hover:bg-stone-50 dark:hover:bg-stone-800/60 sm:grid-cols-[160px_70px_70px_minmax(0,1fr)] sm:items-center"
                >
                  <time className="font-mono text-[11px] text-stone-500 dark:text-stone-400">
                    {new Date(entry.timestamp).toLocaleString()}
                  </time>
                  <span>
                    <span
                      className={`admin-badge uppercase ${
                        entry.level === "error" || entry.level === "fatal"
                          ? "admin-badge-danger"
                          : entry.level === "warn"
                          ? "admin-badge-warning"
                          : "admin-badge-neutral"
                      }`}
                    >
                      {entry.level}
                    </span>
                  </span>
                  <span className="font-mono text-xs font-semibold text-stone-600 dark:text-stone-400">
                    {entry.service}
                  </span>
                  <span className="min-w-0 truncate text-xs text-stone-800 dark:text-stone-200">
                    {entry.message}
                  </span>
                </button>
              ))}

              {result.entries.length === 0 && (
                <p className="p-10 text-center text-sm text-stone-500 dark:text-stone-400">
                  No matching events in the bounded searchable index.
                </p>
              )}
            </div>
          </div>

          {result.nextBefore && (
            <button
              type="button"
              onClick={() => {
                setPageCursor(result.nextBefore);
                setLive(false);
              }}
              className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
            >
              <ArrowDown className="h-4 w-4" />
              Older entries
            </button>
          )}
        </>
      )}

      {/* Slideout Detail Drawer */}
      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Log entry details"
          className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs"
          onClick={() => setSelected(null)}
        >
          <div
            className="h-full w-full max-w-xl overflow-y-auto border-l border-stone-200 bg-white p-6 shadow-2xl dark:border-stone-800 dark:bg-stone-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
              <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                Event details
              </h2>
              <button
                type="button"
                aria-label="Close details"
                onClick={() => setSelected(null)}
                className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mb-4 text-sm font-semibold text-stone-800 dark:text-stone-200">
              {selected.message}
            </p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-xl border border-stone-200 bg-stone-50 p-4 font-mono text-xs leading-relaxed text-stone-800 dark:border-stone-800 dark:bg-stone-950 dark:text-stone-200">
              {JSON.stringify(selected, null, 2)}
            </pre>
            <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
              Only approved sanitized fields are displayed. Raw journal entries are never exposed.
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
        <Search className="h-4 w-4 shrink-0" />
        <span>
          This read-only viewer scans bounded file tails (32 KiB per segment), not the complete journal. Very busy segments may require host-level incident investigation. No shell commands or other applications are exposed.
        </span>
      </div>
    </div>
  );
}
