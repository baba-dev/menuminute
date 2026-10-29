import type { KitchenWorkView } from "./service";

/** Only rows returned by the authorized kitchen snapshot are included. These are
 * visible-device metrics, not unsupported claims about the entire organization. */
export function kitchenPulse(work: readonly KitchenWorkView[]) {
  const live = work.filter((item) => item.status !== "cancelled");
  return {
    queued: live.filter((item) => item.status === "queued").length,
    preparing: live.filter((item) => item.status === "preparing").length,
    completed: live.filter((item) => item.status === "complete").length,
    activeOrders: new Set(live.map((item) => item.orderId)).size,
  };
}
export function stationGroups(work: readonly KitchenWorkView[], stationId: string | undefined) {
  const relevant = stationId ? work.filter((item) => item.stationId === stationId) : [...work];
  const byAge = (a: KitchenWorkView, b: KitchenWorkView) =>
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
    a.orderNumber - b.orderNumber ||
    a.id.localeCompare(b.id);
  return {
    queued: relevant.filter((item) => item.status === "queued").sort(byAge),
    preparing: relevant.filter((item) => item.status === "preparing").sort(byAge),
    complete: relevant.filter((item) => item.status === "complete").sort(byAge),
  };
}
export function outstandingDishes(work: readonly KitchenWorkView[]) {
  const totals = new Map<string, number>();
  for (const item of work) {
    if (item.status !== "queued" && item.status !== "preparing") continue;
    totals.set(item.dishName, (totals.get(item.dishName) ?? 0) + item.quantity);
  }
  return [...totals].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Counters are based exclusively on the caller's permission-filtered snapshot.
 * No station or tenant content is fetched from a broader source here. */
export function stationOverview(
  stations: readonly { id: string; name: string }[],
  work: readonly KitchenWorkView[],
  now: number | null
) {
  return stations.map((station) => {
    const current = work.filter((item) => item.stationId === station.id);
    const unfinished = current.filter(
      (item) => item.status === "queued" || item.status === "preparing"
    );
    const oldest = unfinished.reduce<number | null>((value, item) => {
      const timestamp = Date.parse(item.createdAt);
      return Number.isFinite(timestamp)
        ? value === null
          ? timestamp
          : Math.min(value, timestamp)
        : value;
    }, null);
    return {
      ...station,
      queued: current.filter((item) => item.status === "queued").length,
      preparing: current.filter((item) => item.status === "preparing").length,
      completed: current.filter((item) => item.status === "complete").length,
      oldestMinutes:
        now !== null && oldest !== null ? Math.max(0, Math.floor((now - oldest) / 60000)) : null,
    };
  });
}
