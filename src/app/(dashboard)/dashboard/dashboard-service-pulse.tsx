"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";
import type { DashboardPulseSnapshot } from "@/modules/menu-product/dashboard-optional-pulse";

const REFRESH_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

function timeLabel(timestamp: string) {
  const time = new Date(timestamp);
  return Number.isNaN(time.getTime()) ? "time unavailable" : time.toISOString().slice(11, 16) + " UTC";
}

export function DashboardServicePulse({
  outletId,
  initial,
}: {
  outletId: string;
  initial: DashboardPulseSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (running.current || document.visibilityState !== "visible" || !navigator.onLine) return;
    running.current = true;
    setRefreshing(true);
    const abort = new AbortController();
    controller.current = abort;
    const timer = window.setTimeout(() => abort.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch("/api/dashboard/pulse", {
        cache: "no-store",
        credentials: "same-origin",
        headers: { accept: "application/json" },
        signal: abort.signal,
      });
      if (!response.ok) throw new Error("Service activity could not be refreshed");
      const body: unknown = await response.json();
      if (!body || typeof body !== "object" || !("outletId" in body) ||
          body.outletId !== outletId || !("state" in body) ||
          !("checkedAt" in body) || typeof body.checkedAt !== "string" ||
          (body.state !== "ready" && body.state !== "restricted" && body.state !== "unavailable")) {
        throw new Error("Invalid service activity response");
      }
      const responseBody = body as { state: DashboardPulseSnapshot["state"]; data?: unknown; checkedAt: string };
      if (responseBody.state === "ready") {
        const data = responseBody.data;
        if (!data || typeof data !== "object" ||
            !["pending", "preparing", "ready", "active", "completedToday"].every(
              (key) => typeof (data as Record<string, unknown>)[key] === "number"
            )) {
          throw new Error("Invalid service activity counters");
        }
      }
      setSnapshot({
        state: responseBody.state,
        data: responseBody.state === "ready"
          ? responseBody.data as Extract<DashboardPulseSnapshot, { state: "ready" }>["data"]
          : null,
        checkedAt: responseBody.checkedAt,
      } as DashboardPulseSnapshot);
    } catch {
      if (!abort.signal.aborted || document.visibilityState === "visible") {
        setSnapshot({ state: "unavailable", data: null, checkedAt: new Date().toISOString() });
      }
    } finally {
      window.clearTimeout(timer);
      if (controller.current === abort) controller.current = null;
      running.current = false;
      setRefreshing(false);
    }
  }, [outletId]);

  useEffect(() => {
    const onResume = () => { if (document.visibilityState === "visible") void refresh(); };
    const timer = window.setInterval(onResume, REFRESH_MS);
    window.addEventListener("focus", onResume);
    window.addEventListener("online", onResume);
    document.addEventListener("visibilitychange", onResume);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onResume);
      window.removeEventListener("online", onResume);
      document.removeEventListener("visibilitychange", onResume);
      controller.current?.abort();
    };
  }, [refresh]);

  return (
    <section className="mm-dashboard-operations" aria-labelledby="mm-operations-title">
      <div className="mm-dashboard-operations-heading">
        <div>
          <span className="mm-dashboard-eyebrow">SERVICE ACTIVITY</span>
          <h2 id="mm-operations-title">What needs attention now</h2>
          <p>Current outlet counts from the authoritative order ledger.</p>
        </div>
        {snapshot.state !== "restricted" && (
          <button type="button" className="mm-dashboard-operations-refresh" disabled={refreshing}
            aria-label="Refresh service activity" onClick={() => void refresh()}>
            <RefreshCw size={16} aria-hidden="true" /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>
      {snapshot.state === "ready" ? (
        <>
          <p className="mm-dashboard-operations-freshness" role="status">
            Snapshot updated at {timeLabel(snapshot.checkedAt)} · Refreshes every 30 seconds while this tab is active
          </p>
          <div className="mm-dashboard-operations-grid">
            {([
              ["pending", "Awaiting acceptance"],
              ["preparing", "In preparation"],
              ["ready", "Ready for handoff"],
              ["completedToday", "Completed today"],
            ] as const).map(([field, label]) => (
              <Link key={field} href="/dashboard/orders">
                <strong>{snapshot.data[field].toLocaleString("en")}</strong>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="mm-dashboard-operations-notice" role="status">
          <strong>{snapshot.state === "restricted" ? "Order activity access required" : "Order activity temporarily unavailable"}</strong>
          <p>{snapshot.state === "restricted"
            ? "Your role does not include order visibility for this outlet. Ask an outlet administrator for access."
            : "Menu publishing and QR codes are unaffected. Use Refresh to retry service activity."}</p>
        </div>
      )}
    </section>
  );
}
