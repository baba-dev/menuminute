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
  BellRing,
  Droplets,
  ReceiptText,
} from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { RubberStamp, ChefStickyNote } from "@/components/ui/tactile-elements";
import { getGuestOrderNote, getOrderStampVariant } from "@/lib/hospitality-order-status";

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

const TERMINAL_STATUSES = ["served", "collected", "rejected", "cancelled", "expired"];

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
  const terminalRef = useRef(false);
  const [callingService, setCallingService] = useState(false);
  const [serviceError, setServiceError] = useState("");
  const [serviceRequests, setServiceRequests] = useState<
    Array<{
      requestId: string;
      signal: string;
      status: string;
      requestedAt: string;
    }>
  >([]);
  const [serviceNotice, setServiceNotice] = useState("");

  useEffect(() => {
    if (!trackingToken) return;
    try {
      sessionStorage.setItem(`order_${token}_${orderId}`, trackingToken);
      window.history.replaceState(window.history.state, "", window.location.pathname);
    } catch {
      // Private mode may disable session storage.
    }
  }, [trackingToken, token, orderId]);

  /** Returns true when the poll succeeded; callers use it to back off on failure. */
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
      terminalRef.current = TERMINAL_STATUSES.includes(json.order.status);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error loading tracking");
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [orderId, capability, token]);

  useEffect(() => {
    if (!capability) return;
    let active = true;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const schedule = () => {
      if (!active) return;
      // 4s while healthy; exponential backoff to 60s after failures.
      const delay = Math.min(4000 * 2 ** failures, 60000);
      timer = setTimeout(() => void tick(), delay);
    };
    const tick = async () => {
      timer = null;
      if (!active) return;
      // Hidden tabs resume from the visibilitychange handler instead of polling.
      if (document.visibilityState === "hidden") return;
      const ok = await fetchTracking();
      if (!active) return;
      failures = ok ? 0 : Math.min(failures + 1, 4);
      if (ok && terminalRef.current) return;
      schedule();
    };
    const onVisible = () => {
      if (document.visibilityState !== "visible" || timer || terminalRef.current) return;
      failures = 0;
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    void Promise.resolve().then(() => void tick());
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [capability, fetchTracking]);

  const serviceUrl = `/api/public-orders/${encodeURIComponent(orderId)}/service-call`;
  const refreshServices = useCallback(async () => {
    if (!capability) return;
    try {
      const res = await fetch(serviceUrl + `?token=${encodeURIComponent(token)}`, {
        headers: { "x-tracking-token": capability },
        cache: "no-store",
      });
      if (!res.ok) throw Error("Service request status currently unavailable");
      setServiceRequests(await res.json());
      setServiceError("");
    } catch (e) {
      setServiceError(e instanceof Error ? e.message : "Request status unavailable");
    }
  }, [capability, serviceUrl, token]);
  useEffect(() => {
    if (!capability || data?.order.fulfillmentMode !== "dine_in") return;
    void Promise.resolve().then(refreshServices);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshServices();
    }, 12000);
    return () => window.clearInterval(id);
  }, [capability, data?.order.fulfillmentMode, refreshServices]);
  async function callService(signal: "call_server" | "water_refill" | "bill_request") {
    if (!capability || callingService) return;
    setCallingService(true);
    setServiceNotice("");
    try {
      const res = await fetch(serviceUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, trackingToken: capability, signal }),
      });
      if (!res.ok) throw Error("Could not save request. Please ask staff directly.");
      const response = (await res.json()) as { status: string; debounced: boolean };
      setServiceNotice(
        response.debounced
          ? "An identical recent request is already recorded. Please check its status below."
          : "Request saved. Waiting for a staff member to acknowledge it."
      );
      await refreshServices();
    } catch (e) {
      setServiceNotice(e instanceof Error ? e.message : "Request was not recorded.");
    } finally {
      setCallingService(false);
    }
  }

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
                variant={getOrderStampVariant(order.status)}
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
            author="Order update"
            text={getGuestOrderNote(order.status, order.fulfillmentMode, order.point)}
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
                    ? "Your order is ready for pickup. Check the restaurant’s collection instructions."
                    : "Your order is ready for serving. Please wait for the restaurant team."}
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
                <strong>
                  {order.status === "rejected"
                    ? "Order Declined"
                    : order.status === "expired"
                      ? "Acceptance Expired"
                      : "Order Cancelled"}
                </strong>
                <p>
                  {order.rejectionReason ||
                    (order.status === "expired"
                      ? "The restaurant did not accept this request before its deadline."
                      : order.status === "cancelled"
                        ? "This order was cancelled. Please contact staff if you need assistance."
                        : "The restaurant was unable to accept your request. Please contact staff.")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Stepper Timeline (if not rejected/cancelled) */}
        {!isTerminalNegative && (
          <div className="panel stack" style={{ gap: "1rem" }}>
            <span className="section-title">Preparation Progress</span>
            <p className="step-state" role="status" aria-live="polite">
              {`Current status: ${steps.find((_, i) => getStepState(i) === "active")?.label ?? order.status}`}
            </p>
            <ol className="stepper-track" aria-label="Order progress">
              {steps.map((s, idx) => {
                const state = getStepState(idx);
                const IconComponent = s.icon;
                return (
                  <li
                    key={s.id}
                    className={`stepper-step row ${state}`}
                    aria-current={state === "active" ? "step" : undefined}
                  >
                    <div className="step-indicator" aria-hidden="true">
                      <IconComponent size={16} />
                    </div>
                    <div className="stack" style={{ gap: "0.1rem" }}>
                      <span className="step-title">
                        {s.label}
                        <span className="step-state">
                          {state === "completed"
                            ? " (done)"
                            : state === "active"
                              ? " (current step)"
                              : " (upcoming)"}
                        </span>
                      </span>
                      <small className="quiet">{s.desc}</small>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Service calls are durable requests, not instant-delivery promises. */}
        {order.fulfillmentMode === "dine_in" &&
          !["rejected", "cancelled", "expired", "collected"].includes(order.status) && (
            <section
              className="panel stack"
              aria-labelledby="guest-bell-heading"
              style={{ gap: "0.7rem" }}
            >
              <h2 id="guest-bell-heading" className="section-title">
                Table service
              </h2>
              <p className="quiet" style={{ margin: 0, fontSize: "0.85rem" }}>
                Request assistance at your table. Staff must acknowledge your request; use in-person
                help if urgent.
              </p>
              <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
                {(
                  [
                    { id: "call_server", label: "Call server", Icon: BellRing },
                    { id: "water_refill", label: "Request water", Icon: Droplets },
                    { id: "bill_request", label: "Request bill", Icon: ReceiptText },
                  ] as const
                ).map(({ id, label, Icon }) => (
                  <button
                    type="button"
                    key={id}
                    disabled={callingService}
                    onClick={() => void callService(id)}
                    className="action secondary"
                    style={{ minHeight: 44, flex: "1 1 110px", padding: "0.7rem" }}
                  >
                    <Icon size={17} aria-hidden="true" />
                    {callingService ? "Saving…" : label}
                  </button>
                ))}
              </div>
              {serviceNotice && (
                <p role="status" className="quiet" style={{ fontSize: "0.85rem" }}>
                  {serviceNotice}
                </p>
              )}
              {serviceError && (
                <p role="status" className="quiet" style={{ fontSize: "0.8rem" }}>
                  {serviceError}
                </p>
              )}
              {serviceRequests.length > 0 && (
                <ul className="stack" style={{ gap: "0.3rem" }}>
                  {serviceRequests.slice(0, 3).map((req) => (
                    <li key={req.requestId} className="quiet" style={{ fontSize: "0.8rem" }}>
                      {req.signal === "call_server"
                        ? "Staff assistance"
                        : req.signal === "water_refill"
                          ? "Water refill"
                          : "Bill request"}{" "}
                      · {req.status}
                    </li>
                  ))}
                </ul>
              )}
            </section>
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
          <div className="ticket-receipt-tear -mx-4 mt-4 -mb-4" aria-hidden="true" />
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
