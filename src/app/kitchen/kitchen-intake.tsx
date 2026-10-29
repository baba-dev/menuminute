"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Clock3, RefreshCw, XCircle } from "lucide-react";

type PendingOrder = {
  id: string;
  orderNumber: number;
  version: number;
  createdAt: string;
  customerName: string | null;
  fulfillmentMode: string;
  items: Array<{ quantity: number; nameSnapshot?: string; dishName?: string }>;
};

export function KitchenIntake({
  organizationId,
  outletId,
}: {
  organizationId: string;
  outletId: string;
}) {
  const base = `/api/organizations/${encodeURIComponent(organizationId)}/outlets/${encodeURIComponent(outletId)}/orders`;
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(true);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const response = await fetch(base + "?status=pending", {
        credentials: "same-origin",
        cache: "no-store",
        signal,
      });
      if (!response.ok)
        throw new Error(
          response.status === 401 || response.status === 403
            ? "Kitchen intake permission changed. Sign in again."
            : "Incoming orders cannot synchronize."
        );
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error("Incoming order response is invalid.");
      const parsed = data as PendingOrder[];
      if (
        parsed.some(
          (row) =>
            !row ||
            typeof row.id !== "string" ||
            !Array.isArray(row.items) ||
            row.version === undefined
        )
      ) {
        throw new Error("Incoming order response is incomplete.");
      }
      setOrders(parsed.filter((row) => row && row.id));
      setError("");
      setSyncing(false);
    },
    [base]
  );

  useEffect(() => {
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      void refresh(controller.signal).catch((err) => {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : "Sync failed.");
          setSyncing(false);
        }
      });
    });
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      void refresh(controller.signal).catch((err) => {
        if (!controller.signal.aborted)
          setError(err instanceof Error ? err.message : "Sync failed.");
      });
    }, 6000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      window.cancelAnimationFrame(frame);
    };
  }, [refresh]);

  async function decide(order: PendingOrder, targetStatus: "accepted" | "rejected") {
    if (busy || error) return;
    setBusy(order.id);
    try {
      const response = await fetch(base + "/" + encodeURIComponent(order.id) + "/transition", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetStatus,
          expectedVersion: order.version,
          ...(targetStatus === "rejected" ? { reason: "Declined by kitchen intake" } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "This order changed or expired. Refresh the intake queue."
            : "Could not confirm the order action. Refresh before retrying."
        );
      // Existing order transition atomically fans out Kitchen station tickets.
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Order action could not be confirmed.");
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="kk-intake" aria-labelledby="kk-intake-title" aria-live="off">
      <header className="kk-intake-header">
        <div>
          <p className="kk-eyebrow">LIVE / NEW ORDERS</p>
          <h2 id="kk-intake-title">Incoming kitchen orders</h2>
          <p>
            Accept an order to route every dish to its assigned station. No merchant-board handoff
            required.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh().catch((err) => setError(String(err)))}
          disabled={Boolean(busy)}
          className="kk-intake-refresh"
        >
          <RefreshCw size={16} aria-hidden="true" /> Refresh
        </button>
      </header>
      {error && (
        <p role="alert" className="kk-intake-error">
          {error} Order actions are paused until synchronized.
        </p>
      )}
      {syncing && <p className="kk-intake-empty">Synchronizing incoming orders…</p>}
      {!syncing && !error && !orders.length && (
        <div className="kk-intake-empty">
          <CheckCircle2 size={20} /> All incoming orders are accounted for.
        </div>
      )}
      {!error && orders.length > 0 && (
        <div className="kk-intake-grid">
          {orders.map((order) => (
            <article className="kk-intake-card" key={order.id}>
              <div className="kk-intake-card-head">
                <strong>Order #{order.orderNumber}</strong>
                <span>
                  <Clock3 size={13} aria-hidden="true" />{" "}
                  {new Date(order.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              <p>
                {order.customerName || "Guest"} ·{" "}
                {order.fulfillmentMode === "pickup" ? "Pickup" : "Dine-in"}
              </p>
              <div className="kk-intake-items">
                {order.items.map((item, i) => (
                  <span key={i}>
                    {item.quantity}× {item.nameSnapshot || item.dishName || "Menu dish"}
                  </span>
                ))}
              </div>
              <div className="kk-intake-actions">
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void decide(order, "accepted")}
                  className="kk-intake-accept"
                >
                  <CheckCircle2 size={16} /> Accept & route
                </button>
                <button
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void decide(order, "rejected")}
                  className="kk-intake-decline"
                >
                  <XCircle size={16} /> Decline
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
