"use client";
import { useCallback, useEffect, useState } from "react";
import type { GuestServiceRequest } from "@/modules/hospitality/service";
export function ServiceRequestsPanel({
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId: string;
}) {
  const [items, setItems] = useState<GuestServiceRequest[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const url = `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/service-requests`;
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw Error("Service request queue unavailable or access denied");
      const data = await res.json();
      setItems(data);
      setError("");
    } catch (e) {
      setItems(null);
      setError(e instanceof Error ? e.message : "Queue unavailable");
    }
  }, [url]);
  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 12000);
    return () => window.clearInterval(id);
  }, [refresh]);
  const change = async (item: GuestServiceRequest, action: "acknowledge" | "resolve") => {
    setBusy(item.id);
    setError("");
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestId: item.id, action }),
      });
      if (!res.ok) throw Error("Could not update request. Refresh and retry.");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy("");
    }
  };
  return (
    <section
      aria-labelledby="service-bells-title"
      className="my-6 rounded-xl border border-stone-300 p-4 dark:border-stone-700"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id="service-bells-title" className="font-display text-lg font-bold">
            Guest Service Requests
          </h2>
          <p className="text-xs opacity-70">
            Staff acknowledgement required · Checked approximately every 12 seconds
          </p>
        </div>
        <button
          onClick={() => void refresh()}
          type="button"
          className="min-h-11 rounded border border-current/30 px-3 text-sm"
        >
          Refresh
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      {items === null ? (
        <p className="py-4 text-sm">
          Request queue unavailable; no claims about outstanding requests.
        </p>
      ) : items.length === 0 ? (
        <p className="py-4 text-sm">No outstanding guest service requests.</p>
      ) : (
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <li key={item.id} className="rounded-lg border border-current/20 p-3 text-sm">
              <strong>
                Table {item.tableNumber} · Order #{item.orderNumber}
              </strong>
              <p>
                {item.signal === "call_server"
                  ? "Call server"
                  : item.signal === "water_refill"
                    ? "Water refill"
                    : "Bill request"}
              </p>
              <p className="text-xs opacity-70">
                {item.status} · {new Date(item.requestedAt).toLocaleTimeString()}
              </p>
              <button
                type="button"
                disabled={busy !== ""}
                className="mt-2 min-h-11 rounded bg-stone-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-stone-200 dark:text-stone-950"
                onClick={() =>
                  void change(item, item.status === "requested" ? "acknowledge" : "resolve")
                }
              >
                {busy === item.id
                  ? "Saving…"
                  : item.status === "requested"
                    ? "Acknowledge"
                    : "Mark resolved"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
