"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCheck, RefreshCw, ChefHat, AlertTriangle, ClipboardCheck, Check } from "lucide-react";
import type {
  KitchenExpoSnapshot,
  KitchenExpoOrder,
  KitchenExpoItem,
  KitchenWorkView,
  KitchenSnapshot,
} from "@/modules/kitchen/service";
import { KITCHEN_WAIT_ALERT_MINUTES } from "@/modules/kitchen/presentation";
import { DishDetails } from "./dish-details";
type Props = {
  base: string;
  enabled: boolean;
  cursor: number;
  work: KitchenWorkView[];
  stations: KitchenSnapshot["stations"];
};
const stateLabel = (item: KitchenExpoItem) =>
  item.releasedAt
    ? "Released"
    : item.status === "complete"
      ? "Ready to release"
      : item.status === "preparing"
        ? "Cooking"
        : "Waiting to start";
export function KitchenExpeditor({ base, enabled, cursor }: Props) {
  const [data, setData] = useState<KitchenExpoSnapshot>({ cursor: 0, overflow: false, orders: [] });
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  // Second step of the review gate for releasing several dishes at once.
  const [confirming, setConfirming] = useState("");
  const [now, setNow] = useState<number | null>(null);
  const active = useRef(true);
  const sequence = useRef(0);
  const sync = useCallback(async () => {
    const request = ++sequence.current;
    const response = await fetch(base + "/expo", { cache: "no-store" });
    if (!response.ok) {
      if (!active.current || request !== sequence.current) return;
      // Only a revoked session clears the list; a transient failure keeps the last
      // good data on screen (with a warning) instead of blanking the pass.
      const revoked = response.status === 401 || response.status === 403;
      if (revoked) setData({ cursor: 0, overflow: false, orders: [] });
      throw new Error(
        revoked
          ? "Final Check access or connection has changed. Refresh and verify permissions."
          : "Final Check could not refresh. Showing the last known orders; verify before releasing."
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

  async function post(path: string, body: unknown) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      const details = (await response
        .json()
        .catch(() => ({ message: "Release not confirmed" }))) as {
        message?: string;
      };
      throw new Error(details.message ?? "Release not confirmed");
    }
  }
  /** Run one or more authoritative server commands, then reconcile. */
  async function run(label: string, commands: Array<{ path: string; body: unknown }>) {
    if (pending || !enabled || commands.length === 0) return;
    setConfirming("");
    setPending(label);
    setError("");
    try {
      for (const command of commands) await post(command.path, command.body);
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
  const itemCommand = (item: KitchenExpoItem) => ({
    path: "/release-item",
    body: { workId: item.workId, expectedVersion: item.version, key: crypto.randomUUID() },
  });
  const readyOf = (order: KitchenExpoOrder) =>
    order.items.filter((item) => item.status === "complete" && !item.releasedAt);
  const needsCheck = data.orders.filter((order) => readyOf(order).length > 0).length;
  const primaryButton =
    "mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-500 px-4 font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-45";
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
            Check each dish against the order — items, spice level, notes and packing — then release
            it. Dishes can leave one by one as they finish; the order is Ready when its last dish
            goes.
          </p>
          {needsCheck > 0 && (
            <p className="kk-check-banner" role="status">
              <ClipboardCheck size={16} aria-hidden="true" />
              {needsCheck === 1
                ? "1 order has dishes waiting for a final check"
                : `${needsCheck} orders have dishes waiting for a final check`}
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
        <div
          role="alert"
          className="mt-3 flex items-center justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-900 dark:bg-red-950 dark:text-red-200"
        >
          {error}
          <button type="button" onClick={() => setError("")} className="min-h-10 px-2 underline">
            Dismiss
          </button>
        </div>
      )}
      <div className="kk-expeditor-orders mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {data.orders.map((order) => {
          const ready = readyOf(order);
          const allDone = order.total > 0 && order.done === order.total;
          const late =
            now !== null &&
            ready.length > 0 &&
            now - new Date(order.createdAt).getTime() >= KITCHEN_WAIT_ALERT_MINUTES * 60000;
          return (
            <article
              key={order.id}
              className={
                "kk-expo-card p-4" +
                (ready.length > 0 ? " kk-expo-card-check" : "") +
                (late ? " kk-expo-card-late" : "")
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
              {ready.length > 0 && (
                <p className="kk-check-pill">
                  <ClipboardCheck size={14} aria-hidden="true" /> Check before release
                </p>
              )}
              {order.orderNotes && (
                <p className="kk-expo-order-note">Order note: {order.orderNotes}</p>
              )}
              <p className="mt-3 text-sm font-semibold tabular-nums">
                {order.done} / {order.total} dishes ready · {order.released} released
              </p>
              <ul className="kk-expo-items" aria-label={`Order ${order.orderNumber} dishes`}>
                {order.items.map((item) => (
                  <li
                    key={item.workId}
                    className={
                      "kk-expo-item" +
                      (item.releasedAt
                        ? " is-released"
                        : item.status === "complete"
                          ? " is-ready"
                          : "")
                    }
                  >
                    <div className="kk-expo-item-main">
                      <strong>
                        {item.quantity} × {item.dishName}
                      </strong>
                      <DishDetails
                        compact
                        variantName={item.variantName}
                        selectedOptions={item.selectedOptions}
                        notes={item.notes}
                        dishSafety={item.dishSafety}
                      />
                      <small>
                        {item.stationName} · {stateLabel(item)}
                      </small>
                    </div>
                    {item.status === "complete" && !item.releasedAt && (
                      <button
                        type="button"
                        disabled={!enabled || !!pending}
                        onClick={() => void run(item.workId, [itemCommand(item)])}
                        aria-label={`Release ${item.dishName} for order ${order.orderNumber}`}
                        className="kk-expo-release"
                      >
                        {pending === item.workId ? "Releasing…" : "Release"}
                      </button>
                    )}
                    {item.releasedAt && <Check size={18} aria-label="Released" />}
                  </li>
                ))}
              </ul>
              <div
                className="mt-2 h-2 w-full overflow-hidden rounded-full bg-stone-200 dark:bg-stone-800"
                role="progressbar"
                aria-valuenow={order.released}
                aria-valuemin={0}
                aria-valuemax={order.total}
                aria-label={`Order ${order.orderNumber} dishes released`}
              >
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{ width: `${order.total ? (order.released / order.total) * 100 : 0}%` }}
                />
              </div>
              {ready.length > 0 ? (
                <button
                  type="button"
                  disabled={!enabled || !!pending}
                  onClick={() => {
                    if (confirming === order.id)
                      void run(
                        order.id,
                        allDone
                          ? [
                              {
                                path: "/release",
                                body: {
                                  orderId: order.id,
                                  expectedVersion: order.version,
                                  key: crypto.randomUUID(),
                                },
                              },
                            ]
                          : ready.map(itemCommand)
                      );
                    else setConfirming(order.id);
                  }}
                  className={primaryButton}
                >
                  <CheckCheck size={18} />{" "}
                  {pending === order.id
                    ? "Confirming…"
                    : confirming === order.id
                      ? `Checked — release ${ready.length} now`
                      : allDone
                        ? "Final check, then release all"
                        : `Final check, then release ${ready.length} ready`}
                </button>
              ) : (
                <p className="kk-expo-waiting">
                  {order.status === "accepted"
                    ? "Waiting for the first dish to finish"
                    : "Nothing new to release — dishes appear here as they finish"}
                </p>
              )}
            </article>
          );
        })}
        {!data.orders.length && (
          <p className="col-span-full rounded-xl border border-dashed border-stone-300 p-7 text-center text-sm text-stone-600 dark:border-stone-700 dark:text-stone-300">
            No kitchen orders awaiting final check or release.
          </p>
        )}
      </div>
    </section>
  );
}
