"use client";

import { useEffect, useState, useRef } from "react";
import {
  ShoppingBag,
  Clock,
  CheckCircle2,
  ChefHat,
  Utensils,
  Volume2,
  VolumeX,
  RefreshCw,
  XCircle,
  AlertTriangle,
  User,
  Phone,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { playOrderChime } from "@/lib/sound";

export type MerchantOrderItem = {
  id: string;
  orderId: string;
  itemName: string;
  variantName: string | null;
  selectedOptions: {
    groupId: string;
    groupName: string;
    optionId: string;
    optionName: string;
    priceMinor: number;
  }[];
  unitPriceMinor: number;
  totalMinor: number;
  quantity: number;
  notes: string | null;
};

export type MerchantOrder = {
  id: string;
  restaurantId: string;
  tableId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  fulfillmentMode: string;
  status: string;
  paymentStatus: string;
  currency: string;
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  notes: string | null;
  rejectionReason: string | null;
  orderNumber: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  items: MerchantOrderItem[];
};

export function LiveOrdersBoard({
  organizationId,
  outletId,
  currency,
}: {
  organizationId: string;
  outletId: string;
  currency: string;
}) {
  const [orders, setOrders] = useState<MerchantOrder[]>([]);
  const [tab, setTab] = useState<"active" | "completed" | "cancelled">("active");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal for declining/cancelling with a reason
  const [rejectingOrder, setRejectingOrder] = useState<MerchantOrder | null>(null);
  const [declineReason, setDeclineReason] = useState("Kitchen is currently busy");

  const prevPendingIdsRef = useRef<Set<string> | null>(null);

  const fetchOrders = async () => {
    try {
      setIsRefreshing(true);
      const res = await fetch(
        `/api/organizations/${organizationId}/outlets/${outletId}/orders`,
        { cache: "no-store" }
      );
      if (!res.ok) throw new Error("Failed to load orders");
      const data: MerchantOrder[] = await res.json();

      // Check if new pending orders arrived
      const pendingIds = new Set(data.filter((o) => o.status === "pending").map((o) => o.id));
      if (
        soundEnabled &&
        prevPendingIdsRef.current &&
        [...pendingIds].some((id) => !prevPendingIdsRef.current?.has(id))
      ) {
        playOrderChime();
      }
      prevPendingIdsRef.current = pendingIds;

      setOrders(data);
      setErrorMessage(null);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Network error fetching orders");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 5000);
    return () => clearInterval(interval);
  }, [organizationId, outletId, soundEnabled]);

  const handleTransition = async (
    order: MerchantOrder,
    targetStatus: string,
    reason?: string,
    paymentStatus?: string
  ) => {
    try {
      const res = await fetch(
        `/api/organizations/${organizationId}/outlets/${outletId}/orders/${order.id}/transition`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetStatus,
            expectedVersion: order.version,
            reason,
            paymentStatus,
          }),
        }
      );

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.message || "Failed to update order status");
      }

      setRejectingOrder(null);
      await fetchOrders();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : "Error transitioning order");
    }
  };

  const activeOrders = orders.filter((o) =>
    ["pending", "accepted", "preparing", "ready"].includes(o.status)
  );
  const completedOrders = orders.filter((o) =>
    ["served", "collected"].includes(o.status)
  );
  const cancelledOrders = orders.filter((o) =>
    ["rejected", "cancelled", "expired"].includes(o.status)
  );

  const pendingOrders = activeOrders.filter((o) => o.status === "pending");
  const inKitchenOrders = activeOrders.filter((o) =>
    ["accepted", "preparing"].includes(o.status)
  );
  const readyOrders = activeOrders.filter((o) => o.status === "ready");

  const displayedOrders =
    tab === "active" ? activeOrders : tab === "completed" ? completedOrders : cancelledOrders;

  return (
    <div className="space-y-6">
      {/* Top Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stone-200 bg-white p-4 shadow-xs dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-stone-900 dark:text-white">
              Live Orders Manager
            </h1>
            <p className="text-xs text-stone-500 dark:text-stone-400">
              {pendingOrders.length > 0 ? (
                <span className="font-semibold text-orange-600 dark:text-orange-400">
                  {pendingOrders.length} ticket(s) waiting for acceptance
                </span>
              ) : (
                "All incoming orders acknowledged"
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => {
              setSoundEnabled((v) => !v);
              if (!soundEnabled) playOrderChime();
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors ${
              soundEnabled
                ? "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900/50 dark:bg-orange-950/30 dark:text-orange-300"
                : "border-stone-200 bg-stone-100 text-stone-600 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-400"
            }`}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            <span>{soundEnabled ? "Audio Chime On" : "Chime Muted"}</span>
          </button>

          {/* Refresh Button */}
          <button
            type="button"
            onClick={fetchOrders}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-800 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700"
          >
            <RefreshCw size={14} className={isRefreshing ? "spin" : ""} />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-stone-200 dark:border-stone-800">
        <button
          type="button"
          onClick={() => setTab("active")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-colors ${
            tab === "active"
              ? "border-orange-600 text-orange-600 dark:text-orange-400"
              : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          <span>Active Orders</span>
          <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700 dark:bg-orange-950 dark:text-orange-300">
            {activeOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("completed")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-colors ${
            tab === "completed"
              ? "border-orange-600 text-orange-600 dark:text-orange-400"
              : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          <span>Completed</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            {completedOrders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab("cancelled")}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-xs font-bold transition-colors ${
            tab === "cancelled"
              ? "border-orange-600 text-orange-600 dark:text-orange-400"
              : "border-transparent text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
        >
          <span>Declined / Cancelled</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-[10px] font-semibold text-stone-600 dark:bg-stone-800 dark:text-stone-400">
            {cancelledOrders.length}
          </span>
        </button>
      </div>

      {errorMessage && (
        <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Active Kanban View */}
      {tab === "active" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Column 1: Pending Acceptance (Urgent) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                <Clock size={15} />
                <span>Pending Acceptance</span>
              </h2>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {pendingOrders.length}
              </span>
            </div>

            {pendingOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-400 dark:border-stone-800">
                No orders waiting for acceptance
              </div>
            ) : (
              pendingOrders.map((order) => (
                <div
                  key={order.id}
                  className="space-y-3 rounded-2xl border-2 border-orange-500 bg-white p-5 shadow-md dark:border-orange-600 dark:bg-stone-900"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-base font-extrabold text-stone-900 dark:text-white">
                        Order #{order.orderNumber}
                      </span>
                      <p className="text-[11px] font-semibold text-orange-600 dark:text-orange-400">
                        {order.fulfillmentMode === "pickup" ? "Takeaway / Pickup" : "Dine In"}
                      </p>
                    </div>
                    <span className="rounded-md bg-orange-100 px-2 py-1 text-[11px] font-bold text-orange-800 dark:bg-orange-950 dark:text-orange-300">
                      Waiting
                    </span>
                  </div>

                  {order.customerName && (
                    <div className="flex items-center gap-1.5 text-xs text-stone-600 dark:text-stone-300">
                      <User size={13} /> <span>{order.customerName}</span>
                      {order.customerPhone && (
                        <span className="text-stone-400">({order.customerPhone})</span>
                      )}
                    </div>
                  )}

                  {order.notes && (
                    <div className="rounded-lg bg-stone-50 p-2 text-xs italic text-stone-600 dark:bg-stone-800 dark:text-stone-300">
                      “{order.notes}”
                    </div>
                  )}

                  {/* Items Summary */}
                  <div className="space-y-1.5 border-t border-stone-100 pt-2 dark:border-stone-800">
                    {order.items.map((i) => (
                      <div key={i.id} className="flex justify-between text-xs">
                        <span className="text-stone-800 dark:text-stone-200">
                          <strong>{i.quantity}×</strong> {i.itemName}
                          {i.variantName && <span className="text-stone-500"> ({i.variantName})</span>}
                        </span>
                        <span className="font-semibold text-stone-700 dark:text-stone-300">
                          {formatPrice(i.totalMinor, currency)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-stone-100 pt-2 font-bold text-stone-900 dark:border-stone-800 dark:text-white">
                    <span className="text-xs">Total:</span>
                    <span className="text-sm">{formatPrice(order.totalMinor, currency)}</span>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleTransition(order, "accepted")}
                      className="flex items-center justify-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                    >
                      <CheckCircle2 size={14} /> Accept
                    </button>
                    <button
                      type="button"
                      onClick={() => setRejectingOrder(order)}
                      className="flex items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
                    >
                      <XCircle size={14} /> Decline
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Column 2: In the Kitchen (Accepted / Preparing) */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
                <ChefHat size={15} />
                <span>In Preparation</span>
              </h2>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                {inKitchenOrders.length}
              </span>
            </div>

            {inKitchenOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-400 dark:border-stone-800">
                No orders cooking right now
              </div>
            ) : (
              inKitchenOrders.map((order) => (
                <div
                  key={order.id}
                  className="space-y-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-xs dark:border-stone-800 dark:bg-stone-900"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-base font-extrabold text-stone-900 dark:text-white">
                        Order #{order.orderNumber}
                      </span>
                      <p className="text-[11px] text-stone-500">
                        {order.fulfillmentMode === "pickup" ? "Takeaway / Pickup" : "Dine In"}
                      </p>
                    </div>
                    <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                      {order.status}
                    </span>
                  </div>

                  {/* Items List */}
                  <div className="space-y-1.5 border-t border-stone-100 pt-2 dark:border-stone-800">
                    {order.items.map((i) => (
                      <div key={i.id} className="text-xs">
                        <span className="font-bold text-stone-900 dark:text-stone-100">
                          {i.quantity}× {i.itemName}
                        </span>
                        {i.variantName && <span className="text-stone-500"> ({i.variantName})</span>}
                        {i.selectedOptions.length > 0 && (
                          <p className="text-[10px] text-stone-400">
                            Add-ons: {i.selectedOptions.map((o) => o.optionName).join(", ")}
                          </p>
                        )}
                        {i.notes && <p className="italic text-stone-500">Note: {i.notes}</p>}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-stone-100 pt-2 dark:border-stone-800">
                    <span className="text-xs font-bold text-stone-900 dark:text-white">
                      {formatPrice(order.totalMinor, currency)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleTransition(order, order.status === "accepted" ? "preparing" : "ready")}
                      className="flex items-center gap-1 rounded-xl bg-orange-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-orange-700"
                    >
                      <Utensils size={13} /> {order.status === "accepted" ? "Start Preparing" : "Mark Ready"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Column 3: Ready for Pickup/Serving */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 size={15} />
                <span>Ready for Table / Pickup</span>
              </h2>
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                {readyOrders.length}
              </span>
            </div>

            {readyOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-stone-200 p-8 text-center text-xs text-stone-400 dark:border-stone-800">
                No orders waiting for handoff
              </div>
            ) : (
              readyOrders.map((order) => {
                const isPickup = order.fulfillmentMode === "pickup";
                const completionStatus = isPickup ? "collected" : "served";

                return (
                  <div
                    key={order.id}
                    className="space-y-3 rounded-2xl border border-emerald-300 bg-white p-5 shadow-xs dark:border-emerald-900/60 dark:bg-stone-900"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="text-base font-extrabold text-stone-900 dark:text-white">
                          Order #{order.orderNumber}
                        </span>
                        <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                          {isPickup ? "Ready for Counter Pickup" : "Ready to Serve to Table"}
                        </p>
                      </div>
                      <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        Ready
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-stone-600 dark:text-stone-300">
                      <span>{order.items.length} items</span>
                      <span className="font-bold text-stone-900 dark:text-white">
                        {formatPrice(order.totalMinor, currency)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => handleTransition(order, completionStatus)}
                        className="flex-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-emerald-700"
                      >
                        {isPickup ? "Mark Collected" : "Mark Served"}
                      </button>


                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Completed / Cancelled List View */}
      {tab !== "active" && (
        <div className="space-y-3">
          {displayedOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stone-200 p-12 text-center text-xs text-stone-400 dark:border-stone-800">
              No orders in this category
            </div>
          ) : (
            displayedOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between rounded-xl border border-stone-200 bg-white p-4 shadow-xs dark:border-stone-800 dark:bg-stone-900"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-900 dark:text-white">
                      Order #{order.orderNumber}
                    </span>
                    <span className="rounded-md bg-stone-100 px-2 py-0.5 text-[10px] font-bold uppercase text-stone-700 dark:bg-stone-800 dark:text-stone-300">
                      {order.status}
                    </span>
                    <span className="text-xs text-stone-400">
                      {order.fulfillmentMode === "pickup" ? "Pickup" : "Dine In"}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500">
                    {order.items.map((i) => `${i.quantity}× ${i.itemName}`).join(", ")}
                  </p>
                  {order.rejectionReason && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      Reason: {order.rejectionReason}
                    </p>
                  )}
                </div>

                <div className="text-right">
                  <span className="font-bold text-stone-900 dark:text-white">
                    {formatPrice(order.totalMinor, currency)}
                  </span>
                  <p className="text-[10px] text-stone-400">
                    {new Date(order.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal for Declining an Order */}
      {rejectingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-xl dark:bg-stone-900">
            <h3 className="text-base font-bold text-stone-900 dark:text-white">
              Decline Order #{rejectingOrder.orderNumber}
            </h3>
            <p className="text-xs text-stone-500">
              Provide a reason. The diner will see this note on their live tracking screen.
            </p>

            <div className="space-y-2">
              {[
                "Kitchen is at maximum capacity",
                "Dish or ingredient is currently sold out",
                "Restaurant is closing for service",
                "Other kitchen reason",
              ].map((reason) => (
                <label key={reason} className="flex items-center gap-2 text-xs text-stone-700 dark:text-stone-300">
                  <input
                    type="radio"
                    name="declineReason"
                    value={reason}
                    checked={declineReason === reason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingOrder(null)}
                className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 dark:border-stone-700 dark:text-stone-300 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleTransition(rejectingOrder, "rejected", declineReason)}
                className="rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
              >
                Decline Order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
