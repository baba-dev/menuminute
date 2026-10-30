"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Lock, RefreshCw, TriangleAlert } from "lucide-react";
import type { DashboardPulseSnapshot } from "@/modules/menu-product/dashboard-optional-pulse";
import { MilestoneTicket } from "@/components/dashboard/milestone-ticket";
import {
  crossedMilestone,
  hasSeenMilestone,
  markMilestoneSeen,
  milestoneStorageKey,
  outletLocalDate,
  type Milestone,
} from "@/modules/dashboard/milestones";

const REFRESH_MS = 30_000;
const REQUEST_TIMEOUT_MS = 8_000;

function timeLabel(timestamp: string, timezone: string) {
  const time = new Date(timestamp);
  if (Number.isNaN(time.getTime())) return "time unavailable";
  try {
    return (
      new Intl.DateTimeFormat("en", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      }).format(time) +
      " (" +
      timezone +
      ")"
    );
  } catch {
    return time.toISOString().slice(11, 16) + " UTC";
  }
}

export function DashboardServicePulse({
  outletId,
  timezone,
  initial,
}: {
  outletId: string;
  timezone: string;
  initial: DashboardPulseSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const running = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const [announcement, setAnnouncement] = useState("");
  // Seeded from the server render so loading the page above a threshold never replays it.
  const lastCompleted = useRef<number | null>(
    initial.state === "ready" ? initial.data.completedToday : null
  );
  const lastPending = useRef<number | null>(
    initial.state === "ready" ? initial.data.pending : null
  );
  const seenThisSession = useRef(new Set<string>());

  const observeReady = useCallback(
    (data: { completedToday: number; pending: number }, checkedAt: string) => {
      const crossed = crossedMilestone(lastCompleted.current, data.completedToday);
      lastCompleted.current = data.completedToday;
      if (crossed) {
        let storage: Storage | null = null;
        try {
          storage = window.localStorage;
        } catch {
          storage = null;
        }
        const key = milestoneStorageKey(outletId, outletLocalDate(checkedAt, timezone), crossed.id);
        if (!hasSeenMilestone(storage, key, seenThisSession.current)) {
          markMilestoneSeen(storage, key, seenThisSession.current);
          setMilestone(crossed);
        }
      }
      // Announce only a meaningful change (new orders waiting), never each 30 s refresh.
      if (lastPending.current !== null && data.pending > lastPending.current) {
        setAnnouncement(
          data.pending === 1
            ? "1 order is awaiting acceptance."
            : data.pending + " orders are awaiting acceptance."
        );
      }
      lastPending.current = data.pending;
    },
    [outletId, timezone]
  );

  // One focal gesture per viewport: while a ticket is open the hero's decorative note rests.
  const rootRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const root = rootRef.current?.closest<HTMLElement>(".mm-dashboard");
    if (!root) return;
    if (milestone) root.setAttribute("data-milestone-open", "true");
    else root.removeAttribute("data-milestone-open");
    return () => root.removeAttribute("data-milestone-open");
  }, [milestone]);

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
      if (
        !body ||
        typeof body !== "object" ||
        !("outletId" in body) ||
        body.outletId !== outletId ||
        !("state" in body) ||
        !("checkedAt" in body) ||
        typeof body.checkedAt !== "string" ||
        (body.state !== "ready" && body.state !== "restricted" && body.state !== "unavailable")
      ) {
        throw new Error("Invalid service activity response");
      }
      const responseBody = body as {
        state: DashboardPulseSnapshot["state"];
        data?: unknown;
        checkedAt: string;
      };
      if (responseBody.state === "ready") {
        const data = responseBody.data;
        if (
          !data ||
          typeof data !== "object" ||
          !["pending", "preparing", "ready", "active", "completedToday"].every(
            (key) => typeof (data as Record<string, unknown>)[key] === "number"
          )
        ) {
          throw new Error("Invalid service activity counters");
        }
      }
      if (responseBody.state === "ready") {
        observeReady(
          responseBody.data as { completedToday: number; pending: number },
          responseBody.checkedAt
        );
      }
      setSnapshot({
        state: responseBody.state,
        data:
          responseBody.state === "ready"
            ? (responseBody.data as Extract<DashboardPulseSnapshot, { state: "ready" }>["data"])
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
  }, [outletId, observeReady]);

  useEffect(() => {
    const onResume = () => {
      if (document.visibilityState === "visible") void refresh();
    };
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
    <section
      ref={rootRef}
      className="mm-dashboard-operations"
      aria-labelledby="mm-operations-title"
    >
      <div className="mm-dashboard-operations-heading">
        <div className="mm-dashboard-service-heading">
          <div>
            <span className="mm-dashboard-eyebrow">SERVICE ACTIVITY</span>
            <h2 id="mm-operations-title">The Service Dispatch</h2>
            <p>What needs attention now · From your live order ledger.</p>
          </div>
          <div className="mm-dashboard-service-art-wrap" aria-hidden="true">
            <Image
              className="mm-dashboard-service-art mm-dashboard-service-art--light"
              src="/brand/dashboard/editorial/service-dispatch-light.svg"
              alt=""
              width={130}
              height={91}
            />
            <Image
              className="mm-dashboard-service-art mm-dashboard-service-art--dark"
              src="/brand/dashboard/editorial/service-dispatch-dark.svg"
              alt=""
              width={130}
              height={91}
            />
          </div>
        </div>
      </div>
      {snapshot.state === "ready" ? (
        <>
          <p className="mm-dashboard-operations-freshness">
            Snapshot updated at {timeLabel(snapshot.checkedAt, timezone)} · Refreshes every 30
            seconds while this tab is active
          </p>
          <div className="mm-dashboard-operations-grid">
            {(
              [
                ["pending", "Awaiting acceptance"],
                ["preparing", "In preparation"],
                ["ready", "Ready for handoff"],
                ["completedToday", "Completed today"],
              ] as const
            ).map(([field, label]) => (
              <Link key={field} href="/dashboard/orders">
                <strong>{snapshot.data[field].toLocaleString("en")}</strong>
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="mm-dashboard-operations-notice" role="status">
          <strong>
            {snapshot.state === "restricted" ? (
              <Lock size={16} aria-hidden="true" />
            ) : (
              <TriangleAlert size={16} aria-hidden="true" />
            )}{" "}
            {snapshot.state === "restricted"
              ? "Order activity access required"
              : "Order activity temporarily unavailable"}
          </strong>
          <p>
            {snapshot.state === "restricted"
              ? "Your role does not include order visibility for this outlet. Ask an outlet administrator for access."
              : "Menu publishing and QR codes are unaffected. Use Refresh to retry service activity."}
          </p>
        </div>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
      {milestone && <MilestoneTicket milestone={milestone} onDismiss={() => setMilestone(null)} />}
      <div className="mm-dashboard-service-footer">
        <Link href="/dashboard/orders">View all orders &rarr;</Link>
        {snapshot.state !== "restricted" && (
          <button
            type="button"
            className="mm-dashboard-operations-refresh"
            disabled={refreshing}
            aria-label="Refresh service activity"
            onClick={() => void refresh()}
          >
            <RefreshCw size={16} aria-hidden="true" /> {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        )}
      </div>
    </section>
  );
}
