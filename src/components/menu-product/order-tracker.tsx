"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle2,
  ChefHat,
  Utensils,
  AlertCircle,
  ArrowLeft,
  RefreshCw,
  ShoppingBag,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { RubberStamp, ChefStickyNote } from "@/components/ui/tactile-elements";

export type TrackingData = {
  order: {
    id: string;
    orderNumber: number;
    status: string;
    paymentStatus: string;
    fulfillmentMode: string;
    currency: string;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    notes: string | null;
    rejectionReason: string | null;
    createdAt: string;
    updatedAt: string;
    point: string | null;
  };
  outlet: {
    name: string;
    currency: string;
  };
  items: {
    id: string;
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
  }[];
  events: {
    id: string;
    fromStatus: string | null;
    toStatus: string;
    note: string | null;
    createdAt: string;
  }[];
};

export function OrderTracker({
  orderId,
  trackingToken,
  token,
}: {
  orderId: string;
  trackingToken: string;
  token: string;
}) {
  const snapshot = useCallback(() => {
    try {
      return sessionStorage.getItem(`order_${token}_${orderId}`) ?? "";
    } catch {
      return "";
    }
  }, [token, orderId]);
  const savedCapability = useSyncExternalStore(
    () => () => {},
    snapshot,
    () => ""
  );
  const capability = trackingToken || savedCapability;
  const [data, setData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!trackingToken) return;
    try {
      sessionStorage.setItem(`order_${token}_${orderId}`, trackingToken);
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } catch {
      // Private mode may disable session storage.
    }
  }, [trackingToken, token, orderId]);

  const fetchTracking = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/public-orders/${encodeURIComponent(orderId)}?token=${encodeURIComponent(token)}`,
        { cache: "no-store", headers: { "x-tracking-token": capability } }
      );
      if (!res.ok) {
        throw new Error("Unable to load order status.");
      }
      const json = await res.json();
      setData(json);
      setError(null);
      if (
        ["served", "collected", "rejected", "cancelled", "expired"].includes(json.order.status) &&
        timerRef.current
      ) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading tracking");
    } finally {
      setIsLoading(false);
    }
  }, [orderId, capability, token]);

  useEffect(() => {
    if (!capability) return;
    let active = true;
    void Promise.resolve().then(() => {
      if (active) void fetchTracking();
    });
    timerRef.current = setInterval(fetchTracking, 4000);
    return () => {
      active = false;
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [capability, fetchTracking]);

  if (capability && isLoading && !data) {
    return (
      <div
        className="product"
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div className="panel quiet stack" style={{ alignItems: "center", padding: "2rem" }}>
          <RefreshCw className="spin" size={24} />
          <p>Connecting to kitchen...</p>
        </div>
      </div>
    );
  }

  if (!capability || !data) {
    return (
      <div className="product" style={{ minHeight: "100vh", padding: "2rem" }}>
        <div className="public-shell stack">
          <div className="panel stack" style={{ textAlign: "center", padding: "2.5rem 1.5rem" }}>
            <AlertCircle size={36} style={{ color: "var(--danger)", margin: "0 auto" }} />
            <h2>Order Details Unavailable</h2>
            <p className="quiet">
              {error ||
                (!capability
                  ? "Private order access is unavailable in this browser."
                  : "Could not locate this order.")}
            </p>
            <Link
              href={`/m/${token}`}
              className="action ember"
              style={{ alignSelf: "center", marginTop: "1rem" }}
            >
              <ArrowLeft size={16} /> Return to Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const { order, outlet, items } = data;
  const isTerminalNegative =
    order.status === "rejected" || order.status === "cancelled" || order.status === "expired";

  const steps = [
    {
      id: "pending",
      label: "Order Sent",
      desc: "Waiting for restaurant to accept",
      icon: Clock,
    },
    {
      id: "accepted",
      label: "Accepted",
      desc: "Order confirmed by team",
      icon: CheckCircle2,
    },
    {
      id: "preparing",
      label: "Preparing",
      desc: "Chef is crafting your food",
      icon: ChefHat,
    },
    {
      id: "ready",
      label: "Ready",
      desc: order.fulfillmentMode === "pickup" ? "Ready at pickup counter" : "Serving to table",
      icon: Utensils,
    },
    {
      id: "done",
      label: "Served",
      desc: "Complete",
      icon: CheckCircle2,
    },
  ];

  const getStepState = (stepIndex: number) => {
    const statusOrder = ["pending", "accepted", "preparing", "ready", "served", "collected"];
    let currentIndex = statusOrder.indexOf(order.status);
    if (order.status === "collected") currentIndex = 4;
    if (order.status === "served") currentIndex = 4;

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "active";
    return "upcoming";
  };

  return (
    <div className="product">
      <div
        className="public-shell stack"
        style={{ maxWidth: "600px", margin: "0 auto", paddingBottom: "3rem" }}
      >
        {/* Top bar with back to menu link */}
        <div className="row between" style={{ alignItems: "center", paddingTop: "1rem" }}>
          <Link
            href={`/m/${token}`}
            className="action"
            style={{ minHeight: "36px", padding: "0.4rem 0.8rem", fontSize: "0.85rem" }}
          >
            <ArrowLeft size={15} /> Back to Menu
          </Link>
          <span className="badge">
            {order.point ? order.point : order.fulfillmentMode === "pickup" ? "Pickup" : "Dine In"}
          </span>
        </div>

        {error && (
          <p role="status" className="error">
            Connection interrupted. Showing the last confirmed order status.
          </p>
        )}
        {/* Hero Card */}
        <div
          className="panel stack"
          style={{ gap: "0.75rem", borderTop: "4px solid var(--ember)" }}
        >
          <div className="row between" style={{ alignItems: "flex-start" }}>
            <div className="stack" style={{ gap: "0.2rem" }}>
              <span className="eyebrow">{outlet.name}</span>
              <h1 style={{ fontSize: "1.8rem", margin: 0 }}>Order #{order.orderNumber}</h1>
            </div>
            <div className="stack" style={{ alignItems: "flex-end", gap: "0.4rem" }}>
              <RubberStamp
                text={order.status.toUpperCase()}
                variant={
                  order.status === "accepted" || order.status === "preparing"
                    ? "confirmed"
                    : order.status === "ready" ||
                        order.status === "delivered" ||
                        order.status === "collected"
                      ? "paid"
                      : order.status === "cancelled" ||
                          order.status === "rejected" ||
                          order.status === "expired"
                        ? "sold-out"
                        : "chef-pick"
                }
              />
              <small className="quiet">
                {new Date(order.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </small>
            </div>
          </div>

          <ChefStickyNote
            author="From the Pass"
            text={
              order.status === "pending"
                ? "Your ticket has landed on the pass rail. Waiting for the chef to call 'Heard!' and fire your dishes."
                : order.status === "accepted"
                  ? "Heard! The chef accepted your order and added it to the active prep line."
                  : order.status === "preparing"
                    ? "Sizzling on the line! Pans are hot and fresh ingredients are being plated."
                    : order.status === "ready"
                      ? order.fulfillmentMode === "pickup"
                        ? "Your food is boxed hot and waiting at the pickup counter!"
                        : `Plates are up! The team is bringing your food to Table ${order.point ?? ""} now.`
                      : "Hope every bite was delicious. Thank you for dining with us today!"
            }
          />

          {/* Essential Invariant Message */}
          {order.status === "pending" && (
            <div className="tracker-status-box pending pulse">
              <Clock size={20} className="pulse-icon" />
              <div>
                <strong>Order Sent to Restaurant</strong>
                <p>
                  Waiting for the team to accept. Submitting does not guarantee acceptance until
                  confirmed.
                </p>
              </div>
            </div>
          )}

          {order.status === "accepted" && (
            <div className="tracker-status-box accepted">
              <CheckCircle2 size={20} />
              <div>
                <strong>Order Accepted!</strong>
                <p>The kitchen has received your ticket and added it to the queue.</p>
              </div>
            </div>
          )}

          {order.status === "preparing" && (
            <div className="tracker-status-box preparing">
              <ChefHat size={20} />
              <div>
                <strong>Food Being Prepared</strong>
                <p>Your meal is cooking now in the kitchen.</p>
              </div>
            </div>
          )}

          {order.status === "ready" && (
            <div className="tracker-status-box ready">
              <Utensils size={20} />
              <div>
                <strong>Order Ready!</strong>
                <p>
                  {order.fulfillmentMode === "pickup"
                    ? "Please collect your order at the counter."
                    : "Your dishes are being brought to your table."}
                </p>
              </div>
            </div>
          )}

          {(order.status === "served" || order.status === "collected") && (
            <div className="tracker-status-box done">
              <CheckCircle2 size={20} />
              <div>
                <strong>Order Complete</strong>
                <p>We hope you enjoy your meal! Thank you for dining with us.</p>
              </div>
            </div>
          )}

          {isTerminalNegative && (
            <div className="tracker-status-box rejected">
              <AlertCircle size={20} />
              <div>
                <strong>Order {order.status === "rejected" ? "Declined" : "Cancelled"}</strong>
                <p>
                  {order.rejectionReason ||
                    "The restaurant was unable to accept this order at this time. Please speak to staff."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stepper Timeline (if not rejected/cancelled) */}
        {!isTerminalNegative && (
          <div className="panel stack" style={{ gap: "1rem" }}>
            <span className="section-title">Preparation Progress</span>
            <div className="stepper-track stack" style={{ gap: "1rem" }}>
              {steps.map((s, idx) => {
                const state = getStepState(idx);
                const IconComponent = s.icon;
                return (
                  <div key={s.id} className={`stepper-step row ${state}`}>
                    <div className="step-indicator">
                      <IconComponent size={16} />
                    </div>
                    <div className="stack" style={{ gap: "0.1rem" }}>
                      <span className="step-title">{s.label}</span>
                      <small className="quiet">{s.desc}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Itemized Order Summary */}
        <div className="panel stack" style={{ gap: "0.75rem" }}>
          <div className="row between" style={{ alignItems: "center" }}>
            <span className="section-title">Items in This Order</span>
            <span className="badge">
              {items.length} {items.length === 1 ? "dish" : "dishes"}
            </span>
          </div>

          <div className="stack" style={{ gap: "0.75rem" }}>
            {items.map((i) => (
              <div
                key={i.id}
                className="row between"
                style={{ borderBottom: "1px solid var(--decorative)", paddingBottom: "0.5rem" }}
              >
                <div className="stack" style={{ gap: "0.2rem" }}>
                  <div className="row" style={{ gap: "0.5rem" }}>
                    <span style={{ fontWeight: 700 }}>{i.quantity}×</span>
                    <strong style={{ fontWeight: 650 }}>{i.itemName}</strong>
                  </div>
                  {i.variantName && <small className="quiet">Option: {i.variantName}</small>}
                  {i.selectedOptions.length > 0 && (
                    <small className="quiet">
                      Add-ons: {i.selectedOptions.map((o) => o.optionName).join(", ")}
                    </small>
                  )}
                  {i.notes && (
                    <small style={{ fontStyle: "italic", color: "var(--muted)" }}>
                      Note: {i.notes}
                    </small>
                  )}
                </div>
                <span className="money">{formatPrice(i.totalMinor, outlet.currency)}</span>
              </div>
            ))}
          </div>

          {/* Pricing Totals */}
          <div
            className="stack"
            style={{ gap: "0.3rem", borderTop: "1px solid var(--line)", paddingTop: "0.5rem" }}
          >
            <div className="row between">
              <span>Subtotal</span>
              <span className="money">{formatPrice(order.subtotalMinor, outlet.currency)}</span>
            </div>
            <div className="row between">
              <span>Tax</span>
              <small className="quiet">Inclusive</small>
            </div>
            <div className="row between" style={{ fontWeight: 800, fontSize: "1.1rem" }}>
              <span>Total</span>
              <span className="money">{formatPrice(order.totalMinor, outlet.currency)}</span>
            </div>
          </div>

          {/* Pay at counter reminder */}
          <div className="panel quiet stack" style={{ gap: "0.2rem", marginTop: "0.5rem" }}>
            <div className="row between">
              <span style={{ fontWeight: 700 }}>Payment</span>
              <span className="badge" style={{ textTransform: "capitalize" }}>
                {order.paymentStatus === "paid" ? "Paid" : "Pay at Counter / Table"}
              </span>
            </div>
            <small className="quiet">
              {order.paymentStatus === "paid"
                ? "Your payment has been received."
                : "Please pay directly with your server or at the cashier."}
            </small>
          </div>
          <div className="ticket-receipt-tear -mx-4 -mb-4 mt-4" aria-hidden="true" />
        </div>

        {/* Order More CTA */}
        <Link
          href={`/m/${token}`}
          className="action"
          style={{ textAlign: "center", justifyContent: "center", minHeight: "48px" }}
        >
          <ShoppingBag size={16} /> Order Additional Items
        </Link>
      </div>
    </div>
  );
}
