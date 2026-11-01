"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, RefreshCw, ChefHat, AlertTriangle, ClipboardCheck } from "lucide-react";
import type {
  KitchenExpoSnapshot,
  KitchenExpoOrder,
  KitchenWorkView,
  KitchenSnapshot,
} from "@/modules/kitchen/service";
import { KITCHEN_WAIT_ALERT_MINUTES } from "@/modules/kitchen/presentation";
type Props = {
  base: string;
  enabled: boolean;
  cursor: number;
  work: KitchenWorkView[];
  stations: KitchenSnapshot["stations"];
};
export function KitchenExpeditor({ base, enabled, cursor, work, stations }: Props) {
  const [data, setData] = useState<KitchenExpoSnapshot>({ cursor: 0, overflow: false, orders: [] });
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  // Second step of the review gate: the order id the user is about to confirm.
  const [confirming, setConfirming] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const active = useRef(true);
  const sequence = useRef(0);
  const sync = useCallback(async () => {
    const request = ++sequence.current;
    const response = await fetch(base + "/expo", { cache: "no-store" });
    if (!response.ok) {
      if (!active.current || request !== sequence.current) return;
      if (active.current && request === sequence.current)
        setData({ cursor: 0, overflow: false, orders: [] });
      throw new Error(
        "Final Check access or connection has changed. Refresh and verify permissions."
      );
    }
    const latest = (await response.json()) as KitchenExpoSnapshot;
    if (active.current && request === sequence.current) {
      setData((current) => (latest.cursor >= current.cursor ? latest : current));
      setError("");
    }
  }, [base]);
  useEffect(() => {
    active.current = true;
    void Promise.resolve().then(() =>
      sync().catch((e) => setError(e instanceof Error ? e.message : "Cannot load Final Check"))
    );
    const timer = setInterval(
      () =>
        void sync().catch((e) =>
          setError(e instanceof Error ? e.message : "Final Check disconnected")
        ),
      8000
    );
    return () => {
      active.current = false;
      sequence.current += 1;
      clearInterval(timer);
    };
  }, [sync]);
  useEffect(() => {
    if (!enabled) return;
    void Promise.resolve().then(() =>
      sync().catch((e) => setError(e instanceof Error ? e.message : "Final Check disconnected"))
    );
  }, [cursor, enabled, sync]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setNow(Date.now()));
    const clock = setInterval(() => setNow(Date.now()), 30000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(clock);
    };
  }, []);
  useEffect(() => {
    if (!confirming) return;
    const timer = setTimeout(() => setConfirming(""), 8000);
    return () => clearTimeout(timer);
  }, [confirming]);
  const needsCheck = data.orders.filter(
    (order) => order.total > 0 && order.done === order.total
  ).length;
  async function release(order: KitchenExpoOrder) {
    if (
      pending ||
      error ||
      !enabled ||
      !["preparing", "accepted"].includes(order.status) ||
      order.total === 0 ||
      order.done !== order.total
    )
      return;
    const key = crypto.randomUUID();
    setConfirming("");
    setPending(order.id);
    setError("");
    try {
      const response = await fetch(base + "/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: order.id, expectedVersion: order.version, key }),
      });
      if (!response.ok) {
        const details = (await response
          .json()
          .catch(() => ({ message: "Release not confirmed" }))) as { message?: string };
        throw new Error(details.message ?? "Release not confirmed");
      }
      await sync(); // A successful server response is authoritative; the live board reconciles separately.
    } catch (e) {
      setError(
        (e instanceof Error ? e.message : "Release not confirmed") +
          ". Verify the latest order state before retrying."
      );
      void sync().catch(() => {});
    } finally {
      setPending("");
    }
  }
  return (
    <section
      id="expeditor"
      aria-label="Final Check & Order Release"
      className="kk-expeditor scroll-mt-6 p-4 md:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black tracking-[.16em] text-orange-700 uppercase dark:text-orange-400">
            02 / Before it leaves the kitchen
          </p>
          <h3 className="flex items-center gap-2 text-xl font-black">
            <ChefHat aria-hidden="true" size={23} /> Final Check &amp; Order Release
          </h3>
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Check every dish against the order — items, spice level, notes and packing — then
            release it for pickup or serving.
          </p>
          {needsCheck > 0 && (
            <p className="kk-check-banner" role="status">
              <ClipboardCheck size={16} aria-hidden="true" />
              {needsCheck === 1
                ? "1 order needs a final check before release"
                : `${needsCheck} orders need a final check before release`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void sync().catch((e) => setError(String(e)))}
          className="flex min-h-11 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-bold dark:border-stone-700"
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>
      {!enabled && (
        <p
          role="note"
          className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
        >
          Kitchen Pro remains commercially disabled. No new orders are routed to these stations;
          this is a setup/review view.
        </p>
      )}
      {data.overflow && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-orange-100 p-3 text-sm font-bold text-stone-950 dark:bg-orange-950 dark:text-orange-100"
        >
          <AlertTriangle className="mr-2 inline" size={16} />
          More than 60 active kitchen orders. View is bounded to the 60 oldest; reconcile capacity
          before rollout.
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
        </p>
      )}
      <div className="kk-expeditor-orders mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.orders.map((order) => (
          <article
            key={order.id}
            className={
              "kk-expo-card p-4" +
              (order.total > 0 && order.done === order.total ? " kk-expo-card-check" : "") +
              (now !== null &&
              order.total > 0 &&
              order.done === order.total &&
              now - new Date(order.createdAt).getTime() >= KITCHEN_WAIT_ALERT_MINUTES * 60000
                ? " kk-expo-card-late"
                : "")
            }
          >
            <div className="flex justify-between gap-2">
              <h4 className="text-lg font-black">#{order.orderNumber}</h4>
              <span className="text-xs font-bold text-stone-600 uppercase dark:text-stone-300">
                {order.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
              {order.fulfillmentMode === "pickup"
                ? "Pickup"
                : order.tableLabel
                  ? "Table " + order.tableLabel
                  : "Dine in"}{" "}
              · {new Date(order.createdAt).toLocaleTimeString()}
            </p>
            {order.total > 0 && order.done === order.total && (
              <p className="kk-check-pill">
                <ClipboardCheck size={14} aria-hidden="true" /> Check before release
              </p>
            )}
            <p className="mt-3 text-sm font-semibold tabular-nums">
              {order.done} / {order.total} station tasks complete
            </p>
            <ul
              className="kk-expo-station-progress"
              aria-label={`Order ${order.orderNumber} station progress`}
            >
              {stations
                .filter((station) =>
                  work.some((item) => item.orderId === order.id && item.stationId === station.id)
                )
                .map((station) => {
                  const tasks = work.filter(
                    (item) => item.orderId === order.id && item.stationId === station.id
                  );
                  const done = tasks.filter((item) => item.status === "complete").length;
                  return (
                    <li key={station.id}>
                      <span>{station.name}</span>
                      <strong>
                        {done === tasks.length
                          ? "Complete"
                          : tasks.some((item) => item.status === "preparing")
                            ? "Cooking"
                            : "Waiting"}
                      </strong>
                      <small>
                        {done}/{tasks.length}
                      </small>
                    </li>
                  );
                })}
            </ul>
            <div
              className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
              role="progressbar"
              aria-valuenow={order.done}
              aria-valuemin={0}
              aria-valuemax={order.total}
              aria-label={`Order ${order.orderNumber} completed station tasks`}
            >
              <div
                className="h-full rounded-full bg-orange-500"
                style={{ width: `${order.total ? (order.done / order.total) * 100 : 0}%` }}
              />
            </div>
            <button
              type="button"
              disabled={
                !enabled ||
                !!error ||
                !!pending ||
                !["preparing", "accepted"].includes(order.status) ||
                order.total === 0 ||
                order.done !== order.total
              }
              onClick={() => {
                if (confirming === order.id) void release(order);
                else setConfirming(order.id);
              }}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 px-4 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45"
            >
              <CheckCheck size={18} />{" "}
              {pending === order.id
                ? "Confirming…"
                : order.done === order.total && order.total > 0
                  ? confirming === order.id
                    ? "Checked — release now"
                    : "Final check, then release"
                  : order.status === "accepted"
                    ? "Waiting for first station"
                    : "Waiting for remaining stations"}
            </button>
          </article>
        ))}
        {!data.orders.length && (
          <p className="col-span-full rounded-xl border border-dashed border-stone-300 p-7 text-center text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300">
            No kitchen orders awaiting final check or release.
          </p>
        )}
      </div>
    </section>
  );
}
