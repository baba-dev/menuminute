import type { MerchantOrder } from "@/components/orders/types";
export const statusLabels: Record<string, string> = {
  pending: "Awaiting acceptance", accepted: "Accepted", preparing: "In preparation",
  ready: "Ready for handoff", served: "Served", collected: "Collected",
  rejected: "Declined", cancelled: "Cancelled", expired: "Acceptance expired",
  confirmed: "Confirmed", delivered: "Delivered",
};
export function laneFor(status: string): "incoming" | "preparing" | "ready" | null {
  if (status === "pending") return "incoming";
  if (status === "accepted" || status === "preparing") return "preparing";
  if (status === "ready") return "ready";
  return null;
}
export function filterRail(orders: MerchantOrder[], search: string, mode: string) {
  const query = search.trim().toLowerCase().replace(/^#/, "");
  return orders.filter((order) => (mode === "all" || order.fulfillmentMode === mode) &&
    (!query || String(order.orderNumber).includes(query) ||
      (order.customerName ?? "").toLowerCase().includes(query) ||
      (order.servicePoint ?? "").toLowerCase().includes(query)));
}
export function actionFor(order: MerchantOrder): { label: string; status: string } | null {
  if (order.status === "pending" && order.canAccept) return { label: "Accept", status: "accepted" };
  if (order.status === "accepted" && !order.kitchenManaged && order.canPrepare)
    return { label: "Start Preparing", status: "preparing" };
  if (order.status === "preparing" && !order.kitchenManaged && order.canComplete)
    return { label: "Mark Ready", status: "ready" };
  if (order.status === "ready" && order.canComplete)
    return order.fulfillmentMode === "pickup"
      ? { label: "Mark Collected", status: "collected" }
      : { label: "Mark Served", status: "served" };
  return null;
}
