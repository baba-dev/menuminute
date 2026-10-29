"use client";

import { useState, useTransition } from "react";
import { RefreshCw, Play, AlertCircle, CheckCircle2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface FailedEvent {
  id: string;
  organization_id: string;
  outlet_id: string | null;
  type: string;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  created_at: string;
  next_attempt_at: string;
}

export function SystemConsole({
  failedEvents,
  onRetryAction,
}: {
  failedEvents: FailedEvent[];
  onRetryAction: (eventId: string) => Promise<{ success: boolean; error?: string }>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  async function handleRetry(eventId: string) {
    setRetryingId(eventId);
    setMessage(null);
    try {
      const res = await onRetryAction(eventId);
      if (res.success) {
        setMessage({
          text: `Event ${eventId.slice(0, 8)} successfully queued for retry.`,
          type: "success",
        });
        startTransition(() => {
          router.refresh();
        });
      } else {
        setMessage({ text: res.error || "Retry failed", type: "error" });
      }
    } catch (e: any) {
      setMessage({ text: e.message || "Failed to retry", type: "error" });
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-medium ${
            message.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/60 dark:text-emerald-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300"
          }`}
        >
          {message.type === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <div className="admin-card p-5">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3 dark:border-stone-800">
          <div>
            <h2 className="font-display text-sm font-bold text-stone-900 dark:text-stone-100">
              Dead-Letter / Failed Outbox Events
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Recoverable transactional events that exceeded max dispatch attempts.
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.refresh()}
            className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-2xs hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </div>

        {failedEvents.length === 0 ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            <p className="mt-2 text-xs font-semibold text-stone-800 dark:text-stone-200">
              No failed events in outbox queue
            </p>
            <p className="text-[11px] text-stone-500 dark:text-stone-400">
              All background transactions have settled cleanly.
            </p>
          </div>
        ) : (
          <div className="admin-table-container mt-4">
            <table className="admin-table">
              <thead>
                <tr>
                  <th className="p-3">Event Type</th>
                  <th className="p-3">Organization</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Last Error</th>
                  <th className="p-3">Created</th>
                  <th className="p-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="font-mono text-[11px]">
                {failedEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td className="p-3 font-semibold text-orange-600 dark:text-orange-400">
                      {evt.type}
                    </td>
                    <td className="p-3 font-sans text-stone-600 dark:text-stone-400">
                      {evt.organization_id.slice(0, 12)}...
                    </td>
                    <td className="p-3 font-semibold text-stone-800 dark:text-stone-200">
                      {evt.attempts} / {evt.max_attempts}
                    </td>
                    <td
                      className="max-w-xs truncate p-3 text-red-600 dark:text-red-400"
                      title={evt.last_error || "Unknown"}
                    >
                      {evt.last_error || "None"}
                    </td>
                    <td className="p-3 font-sans text-stone-600 dark:text-stone-400">
                      {new Date(evt.created_at).toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-sans">
                      <button
                        type="button"
                        onClick={() => handleRetry(evt.id)}
                        disabled={retryingId === evt.id}
                        className="inline-flex items-center gap-1 rounded-md bg-amber-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-2xs hover:bg-amber-500 disabled:opacity-50"
                      >
                        <Play className="h-3 w-3" />
                        <span>{retryingId === evt.id ? "Retrying..." : "Retry"}</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
