"use client";

import { useEffect, useState } from "react";
import styles from "./water-request.module.css";

type Status = "requested" | "acknowledged" | "resolved";
type State = { water: boolean; request: { status: Status; requestedAt: string } | null };

const POLL_MS = 10_000;

/**
 * Optional "Request water" button on a table QR menu. It renders nothing unless the outlet turned the
 * feature on and this QR is tied to a table; the server decides. The tap only asks staff, it never
 * promises a time, and the status text mirrors what staff recorded.
 */
async function fetchState(token: string): Promise<State | null> {
  try {
    const res = await fetch(`/api/public-orders/table-service?token=${encodeURIComponent(token)}`, {
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as State) : null;
  } catch {
    return null; // Keep the last known state; the menu never depends on this.
  }
}

export function WaterRequest({ token, enabled }: { token: string; enabled: boolean }) {
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // First load, then poll only while a request is open.
  const hasRequest = Boolean(state?.request);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const run = () =>
      void fetchState(token).then((next) => {
        if (!cancelled && next) setState(next);
      });
    run();
    const timer = hasRequest ? window.setInterval(run, POLL_MS) : undefined;
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
    };
  }, [enabled, token, hasRequest]);

  if (!enabled || !state?.water) return null;
  const open = state.request && state.request.status !== "resolved";

  async function tap() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/public-orders/water", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) throw new Error();
      const next = await fetchState(token);
      if (next) setState(next);
    } catch {
      setError("We couldn't send that. Please try again or ask a team member.");
    } finally {
      setBusy(false);
    }
  }

  const status = state.request?.status;
  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={styles.button}
        onClick={() => void tap()}
        disabled={busy || Boolean(open)}
        data-state={status ?? "idle"}
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 3.5c3.2 3.8 5.5 6.6 5.5 9.6a5.5 5.5 0 0 1-11 0c0-3 2.3-5.8 5.5-9.6z" />
        </svg>
        {status === "requested"
          ? "Water requested"
          : status === "acknowledged"
            ? "Water is on the way"
            : status === "resolved"
              ? "Water served · request more"
              : "Request water"}
      </button>
      <p className={styles.note} role="status" aria-live="polite">
        {error ||
          (status === "requested"
            ? "A team member has been notified."
            : status === "acknowledged"
              ? "Your request was seen by the team."
              : "")}
      </p>
    </div>
  );
}
