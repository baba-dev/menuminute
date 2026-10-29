"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  RefreshCw,
  Volume2,
  VolumeX,
  XCircle,
} from "lucide-react";
import { playKitchenBell } from "@/lib/sound-effects";

type PendingOrder = {
  id: string;
  orderNumber: number;
  version: number;
  status: "pending";
  createdAt: string;
  expiresAt: string | null;
  customerName: string | null;
  fulfillmentMode: string;
  items: Array<{ id: string; quantity: number; itemName: string; variantName?: string | null }>;
};

function validateIncoming(payload: unknown): PendingOrder[] {
  if (
    !Array.isArray(payload) ||
    payload.length > 100 ||
    payload.some(
      (order) =>
        !order ||
        typeof order.id !== "string" ||
        !Number.isSafeInteger(order.version) ||
        !Number.isSafeInteger(order.orderNumber) ||
        !Array.isArray(order.items) ||
        typeof order.createdAt !== "string" ||
        order.items.some(
          (item: PendingOrder["items"][number]) =>
            typeof item.itemName !== "string" || !Number.isSafeInteger(item.quantity)
        )
    )
  ) {
    throw new Error("The incoming-order feed is incomplete. Synchronize before acting.");
  }
  return (payload as PendingOrder[])
    .filter((order) => order.status === "pending")
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}

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
  const [inboxOpen, setInboxOpen] = useState(false);
  const [sound, setSound] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const previous = useRef(new Set<string>());
  const initialized = useRef(false);
  const soundEnabled = useRef(false);
  const latestRequest = useRef(0);
  const active = useRef(true);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const requestId = ++latestRequest.current;
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
      const incoming = validateIncoming(await response.json());
      if (!active.current || signal?.aborted || requestId !== latestRequest.current) return;
      const ids = new Set(incoming.map((order) => order.id));
      if (
        initialized.current &&
        incoming.some((order) => !previous.current.has(order.id)) &&
        soundEnabled.current
      ) {
        try {
          playKitchenBell("orders");
        } catch {
          /* browser audio requires a gesture */
        }
      }
      previous.current = ids;
      initialized.current = true;
      setOrders(incoming);
      setError("");
      setSyncing(false);
    },
    [base]
  );

  useEffect(() => {
    active.current = true;
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      setNow(Date.now());
      try {
        const saved = localStorage.getItem("menuminute.kitchen.intake.sound") === "true";
        soundEnabled.current = saved;
        setSound(saved);
      } catch {
        /* optional browser preference */
      }
      void refresh(controller.signal).catch((cause) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : "Intake unavailable.");
          setSyncing(false);
        }
      });
    });
    const timer = window.setInterval(() => {
      setNow(Date.now());
      // A bounded GET to server-owned pending orders is authoritative. Every
      // display reconciles on reconnect rather than relying on volatile toasts.
      void refresh(controller.signal).catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : "Intake connection lost.");
      });
    }, 6000);
    const onVisible = () => {
      if (document.visibilityState === "visible")
        void refresh(controller.signal).catch((cause) => {
          if (!controller.signal.aborted) setError(String(cause));
        });
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active.current = false;
      latestRequest.current += 1;
      controller.abort();
      window.clearInterval(timer);
      window.cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  async function decide(order: PendingOrder, targetStatus: "accepted" | "rejected") {
    if (busy || syncing || error) return;
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
          ...(targetStatus === "rejected" ? { reason: "Declined from Kitchen Pro intake" } : {}),
        }),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? "Another operator changed this order. Synchronize before trying again."
            : "Action not confirmed. Synchronize before trying again."
        );
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action not confirmed.");
      void refresh().catch(() => {});
    } finally {
      setBusy(null);
    }
  }

  const oldest = orders[0];
  const age =
    oldest && now !== null
      ? Math.max(0, Math.floor((now - Date.parse(oldest.createdAt)) / 60000))
      : null;
  const urgent = (age ?? 0) >= 5;
  const present = (order: PendingOrder) => (
    <article
      key={order.id}
      className="kk-live-order"
      aria-label={`Incoming order ${order.orderNumber}`}
    >
      <div className="kk-live-order-head">
        <strong>Order #{order.orderNumber}</strong>
        <span>
          <Clock3 size={14} aria-hidden="true" />{" "}
          {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      <p className="kk-live-order-meta">
        {order.fulfillmentMode === "pickup" ? "Pickup" : "Dine-in"}
        {order.customerName ? " · " + order.customerName : " · Guest"}
      </p>
      <ul className="kk-live-order-items">
        {order.items.map((item) => (
          <li key={item.id}>
            {item.quantity}× {item.itemName}
            {item.variantName ? " · " + item.variantName : ""}
          </li>
        ))}
      </ul>
      <div className="kk-live-order-actions">
        <button
          type="button"
          className="kk-intake-accept"
          disabled={Boolean(busy) || Boolean(error)}
          onClick={() => void decide(order, "accepted")}
        >
          <CheckCircle2 size={17} aria-hidden="true" />{" "}
          {busy === order.id ? "Confirming…" : "Accept & route"}
        </button>
        <button
          type="button"
          className="kk-intake-decline"
          disabled={Boolean(busy) || Boolean(error)}
          onClick={() => void decide(order, "rejected")}
        >
          <XCircle size={16} aria-hidden="true" /> Decline
        </button>
      </div>
    </article>
  );
  return (
    <section className="kk-live-intake" aria-label="Incoming kitchen order attention">
      <div
        className={"kk-intake-dock" + (urgent ? " is-urgent" : "")}
        role="region"
        aria-label="New orders"
      >
        <div className="kk-intake-dock-summary">
          <BellRing size={19} aria-hidden="true" />
          <strong>
            {syncing
              ? "Connecting order intake…"
              : error
                ? "Order intake needs attention"
                : orders.length
                  ? `${orders.length} new order${orders.length === 1 ? "" : "s"} waiting`
                  : "Incoming orders · All clear"}
          </strong>
          {orders.length > 0 && age !== null && (
            <span className="kk-intake-wait">{age} min oldest</span>
          )}
          <button
            type="button"
            className="kk-intake-mini-action"
            aria-label={sound ? "Mute new-order chimes" : "Enable new-order chimes"}
            onClick={() => {
              const enabled = !sound;
              soundEnabled.current = enabled;
              setSound(enabled);
              try {
                localStorage.setItem("menuminute.kitchen.intake.sound", String(enabled));
              } catch {}
              if (enabled) {
                try {
                  playKitchenBell("orders");
                } catch {}
              }
            }}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          <button
            type="button"
            className="kk-intake-mini-action"
            aria-label="Refresh incoming orders"
            onClick={() => void refresh().catch((cause) => setError(String(cause)))}
          >
            <RefreshCw size={17} />
          </button>
          <button
            type="button"
            className="kk-intake-expand"
            aria-expanded={inboxOpen}
            aria-controls="kitchen-incoming-inbox"
            onClick={() => setInboxOpen((value) => !value)}
          >
            {inboxOpen ? "Hide inbox" : "View inbox"}
            {inboxOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
        {error && (
          <p role="alert" className="kk-intake-error">
            {error} Actions paused until synchronized.
          </p>
        )}
        {oldest && !inboxOpen && !error && <div className="kk-live-primary">{present(oldest)}</div>}
        <div id="kitchen-incoming-inbox" hidden={!inboxOpen} className="kk-intake-inbox">
          <h2>
            Incoming orders <span>({orders.length})</span>
          </h2>
          <p>
            Pending orders stay here until accepted, declined or expired. Changing station never
            hides this inbox.
          </p>
          {!orders.length && <p className="kk-intake-empty">No orders awaiting acceptance.</p>}
          {orders.map(present)}
        </div>
      </div>
    </section>
  );
}
