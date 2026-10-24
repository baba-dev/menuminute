"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingBag, X, Plus, Minus, Trash2, ArrowRight, Utensils, Package } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { CartItem, CustomizerDish } from "./item-customizer";
import { startingPriceMinor, type DiningVisual } from "@/modules/menu-product/public-presentation";
import { DiningImage } from "./dining-image";
import {
  clearPendingGuestOrder,
  pendingOrderStorageKey,
  readPendingGuestOrder,
  writePendingGuestOrder,
  type PendingGuestOrder,
} from "@/modules/orders/guest-checkout";

function outletInputValue(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function outletInputToIso(value: string, timezone: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Choose a valid pickup time.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wallClockAsUtc;

  // Resolve the outlet's UTC offset at the target instant. The second pass handles DST boundaries.
  for (let pass = 0; pass < 2; pass += 1) {
    const representedWallClock = outletInputValue(new Date(instant), timezone);
    const represented = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(representedWallClock);
    if (!represented) throw new Error("Choose a valid pickup time.");
    const rYear = Number(represented[1]);
    const rMonth = Number(represented[2]);
    const rDay = Number(represented[3]);
    const rHour = Number(represented[4]);
    const rMinute = Number(represented[5]);
    instant += wallClockAsUtc - Date.UTC(rYear, rMonth - 1, rDay, rHour, rMinute);
  }

  const resolved = new Date(instant);
  if (outletInputValue(resolved, timezone) !== value) {
    throw new Error("That local time does not exist. Choose another pickup time.");
  }
  return resolved.toISOString();
}

function nextPickupSlot(
  openedAt: number,
  leadMinutes: number,
  slotMinutes: number,
  timezone: string
) {
  let candidate = Math.ceil((openedAt + leadMinutes * 60000) / 60000) * 60000;
  for (let minute = 0; minute <= 120; minute += 1) {
    const local = outletInputValue(new Date(candidate), timezone);
    const localHour = Number(local.slice(11, 13));
    const localMinute = Number(local.slice(14, 16));
    if ((localHour * 60 + localMinute) % slotMinutes === 0) return new Date(candidate);
    candidate += 60000;
  }
  return new Date(candidate);
}

export function CartDrawer({
  items,
  currency,
  token,
  outletName,
  point,
  fulfillmentModes = ["dine_in"],
  timezone,
  pickupLeadMinutes = 15,
  pickupSlotMinutes = 15,
  pickupAdvanceDays = 7,
  images = {},
  suggestions = [],
  onChooseSuggestion,
  onUpdateQuantity,
  onRemoveItem,
  onClearCart,
  onOrderSubmitted,
}: {
  items: CartItem[];
  currency: string;
  token: string;
  outletName: string;
  point: string | null;
  fulfillmentModes?: string[];
  timezone: string;
  pickupLeadMinutes?: number;
  pickupSlotMinutes?: number;
  pickupAdvanceDays?: number;
  images?: Record<string, DiningVisual>;
  suggestions?: {
    dish: CustomizerDish;
    category: string;
    currency: string;
    visual: DiningVisual;
  }[];
  onChooseSuggestion?: (dish: CustomizerDish, category: string) => void;
  onUpdateQuantity: (index: number, newQty: number) => void;
  onRemoveItem: (index: number) => void;
  onClearCart: () => void;
  onOrderSubmitted: (result: {
    orderId: string;
    trackingToken: string;
    orderNumber: number;
  }) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [fulfillmentMode, setFulfillmentMode] = useState<"dine_in" | "pickup">(() => {
    return fulfillmentModes.includes("dine_in") ? "dine_in" : "pickup";
  });
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderNotes, setOrderNotes] = useState("");
  const [pickupTime, setPickupTime] = useState("");
  const [pendingRecovery, setPendingRecovery] = useState<PendingGuestOrder | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [checkoutOpenedAt] = useState(() => Date.now());
  const cartRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    restoreRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        event.preventDefault();
        setIsOpen(false);
      }
      if (event.key !== "Tab" || !cartRef.current) return;
      const elements = Array.from(
        cartRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!elements.length) return;
      const first = elements[0]!;
      const last = elements[elements.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = oldOverflow;
      restoreRef.current?.focus();
    };
  }, [isOpen, isSubmitting]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const recovered = readPendingGuestOrder(
        sessionStorage.getItem(pendingOrderStorageKey(token)),
        token
      );
      if (!recovered) return;
      setPendingRecovery(recovered);
      setFulfillmentMode(recovered.fulfillmentMode);
      setCustomerName(recovered.customerName);
      setCustomerPhone(recovered.customerPhone);
      setOrderNotes(recovered.notes);
      setPickupTime(
        recovered.requestedFulfillmentAt
          ? outletInputValue(new Date(recovered.requestedFulfillmentAt), timezone)
          : ""
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [token, timezone]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalMinor = items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);

  if (items.length === 0) return null;

  const handleSubmitOrder = async () => {
    if (fulfillmentMode === "pickup" && !pickupTime && !pendingRecovery) {
      setErrorMessage("Choose a pickup time before submitting your order.");
      setIsOpen(true);
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const freshBody: PendingGuestOrder = {
        token,
        clientSubmissionKey: crypto.randomUUID(),
        quotedTotalMinor: subtotalMinor,
        fulfillmentMode,
        requestedFulfillmentAt:
          fulfillmentMode === "pickup" && pickupTime
            ? outletInputToIso(pickupTime, timezone)
            : null,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        notes: orderNotes.trim(),
        items: items.map((i) => ({
          dishId: i.dishId,
          variantId: i.variantId,
          selectedAddOns: i.selectedAddOns.map((a) => ({
            groupId: a.groupId,
            optionId: a.optionId,
          })),
          quantity: i.quantity,
          itemNotes: i.itemNotes,
        })),
      };
      const body = pendingRecovery ?? freshBody;
      writePendingGuestOrder(body);

      const response = await fetch("/api/public-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status < 500 && response.status !== 429) {
          clearPendingGuestOrder(token);
          setPendingRecovery(null);
        }
        throw new Error(data.message || "The restaurant could not accept this order request.");
      }

      clearPendingGuestOrder(token);
      setPendingRecovery(null);
      onClearCart();
      setIsOpen(false);
      onOrderSubmitted({
        orderId: data.orderId,
        trackingToken: data.trackingToken,
        orderNumber: data.orderNumber,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission outcome is unknown";
      setPendingRecovery(
        readPendingGuestOrder(sessionStorage.getItem(pendingOrderStorageKey(token)), token)
      );
      setErrorMessage(
        message === "Failed to fetch"
          ? "We could not confirm the response. Check the previous submission before trying again."
          : message
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {/* Sticky Floating Bottom Cart Bar */}
      {!isOpen && (
        <div className="sticky-cart-bar no-print">
          <button
            type="button"
            className="cart-bar-button row between ember"
            onClick={() => setIsOpen(true)}
            aria-label="View order cart"
          >
            <div className="row" style={{ gap: "0.75rem", alignItems: "center" }}>
              <div className="cart-badge-icon">
                <ShoppingBag size={18} />
                <span className="cart-badge-count">{totalQuantity}</span>
              </div>
              <div className="stack" style={{ gap: "0.1rem", textAlign: "left" }}>
                <span style={{ fontWeight: 750, fontSize: "0.95rem" }}>View Your Order</span>
                <small style={{ opacity: 0.85 }}>
                  {fulfillmentMode === "pickup"
                    ? "Pickup"
                    : point
                      ? `${point} · Dine In`
                      : "Dine In"}
                </small>
              </div>
            </div>

            <div className="row" style={{ gap: "0.5rem", alignItems: "center" }}>
              <span className="money" style={{ fontSize: "1.1rem", fontWeight: 800 }}>
                {formatPrice(subtotalMinor, currency)}
              </span>
              <ArrowRight size={18} />
            </div>
          </button>
        </div>
      )}

      {/* Slide-Up Full Cart Drawer */}
      {isOpen && (
        <div
          className="cart-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cart-drawer-title"
        >
          <div className="cart-drawer stack dining-cart" ref={cartRef}>
            {/* Header */}
            <div className="cart-header row between">
              <div className="stack" style={{ gap: "0.2rem" }}>
                <span className="eyebrow">{outletName}</span>
                <h2 id="cart-drawer-title" style={{ margin: 0 }}>
                  Your order
                </h2>
                <small>Almost something delicious.</small>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="icon-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close cart"
                style={{ borderRadius: "50%", padding: "0.4rem", minHeight: "36px", width: "36px" }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Service & Fulfillment Selector */}
            <div className="cart-section stack" style={{ gap: "0.5rem" }}>
              <span className="section-title">Order Type</span>
              {fulfillmentModes.length > 1 ? (
                <div className="row" style={{ gap: "0.5rem" }}>
                  {fulfillmentModes.includes("dine_in") && (
                    <button
                      type="button"
                      className={`action ${fulfillmentMode === "dine_in" ? "ink-press" : ""}`}
                      style={{ flex: 1 }}
                      onClick={() => setFulfillmentMode("dine_in")}
                    >
                      <Utensils size={15} />
                      {point ? point : "Dine In"}
                    </button>
                  )}
                  {fulfillmentModes.includes("pickup") && (
                    <button
                      type="button"
                      className={`action ${fulfillmentMode === "pickup" ? "ink-press" : ""}`}
                      style={{ flex: 1 }}
                      onClick={() => setFulfillmentMode("pickup")}
                    >
                      <Package size={15} />
                      Takeaway / Pickup
                    </button>
                  )}
                </div>
              ) : (
                <div className="row" style={{ gap: "0.5rem" }}>
                  <span className="badge">
                    {point
                      ? `${point} · Dine In`
                      : fulfillmentMode === "pickup"
                        ? "Takeaway / Pickup"
                        : "Dine In"}
                  </span>
                </div>
              )}
              {fulfillmentMode === "pickup" && (
                <label className="field-label" htmlFor="pickup-time">
                  <span>Pickup time</span>
                  <input
                    id="pickup-time"
                    type="datetime-local"
                    className="field-input"
                    required
                    min={outletInputValue(
                      nextPickupSlot(
                        checkoutOpenedAt,
                        pickupLeadMinutes,
                        pickupSlotMinutes,
                        timezone
                      ),
                      timezone
                    )}
                    max={outletInputValue(
                      new Date(checkoutOpenedAt + pickupAdvanceDays * 86400000),
                      timezone
                    )}
                    value={pickupTime}
                    step={pickupSlotMinutes * 60}
                    disabled={Boolean(pendingRecovery)}
                    onChange={(event) => setPickupTime(event.target.value)}
                  />
                  <small>Times are shown in {timezone}.</small>
                  <small>
                    Earliest pickup is {pickupLeadMinutes} minutes from now. The restaurant must
                    still accept your order.
                  </small>
                </label>
              )}
            </div>

            {/* Itemized List */}
            <div className="cart-body stack" style={{ flex: 1, overflowY: "auto", gap: "0.8rem" }}>
              <div className="cart-items stack" style={{ gap: "0.75rem" }}>
                {items.map((item, index) => (
                  <div
                    key={index}
                    className="cart-item-card row between"
                    style={{ alignItems: "flex-start" }}
                  >
                    {images[item.dishId] && (
                      <div className="dining-cart-thumb">
                        <DiningImage visual={images[item.dishId]!} />
                      </div>
                    )}
                    <div className="stack" style={{ gap: "0.25rem", flex: 1 }}>
                      <div className="row between">
                        <strong style={{ fontSize: "1rem" }}>{item.dishName}</strong>
                        <span className="money">
                          {formatPrice(item.unitPriceMinor * item.quantity, currency)}
                        </span>
                      </div>

                      {item.variantName && (
                        <small className="quiet">Option: {item.variantName}</small>
                      )}

                      {item.selectedAddOns.length > 0 && (
                        <div className="row" style={{ gap: "0.3rem", flexWrap: "wrap" }}>
                          {item.selectedAddOns.map((a, i) => (
                            <span key={i} className="badge" style={{ fontSize: "0.75rem" }}>
                              +{a.optionName}
                            </span>
                          ))}
                        </div>
                      )}

                      {item.itemNotes && (
                        <small style={{ fontStyle: "italic", color: "var(--muted)" }}>
                          “{item.itemNotes}”
                        </small>
                      )}

                      {/* Stepper + Remove */}
                      <div
                        className="row between"
                        style={{ marginTop: "0.4rem", alignItems: "center" }}
                      >
                        <div
                          className="stepper row"
                          style={{ gap: "0.4rem", alignItems: "center" }}
                        >
                          <button
                            type="button"
                            className="action icon-btn"
                            style={{ minHeight: "32px", width: "32px", padding: 0 }}
                            onClick={() => onUpdateQuantity(index, item.quantity - 1)}
                            aria-label="Decrease quantity"
                          >
                            <Minus size={14} />
                          </button>
                          <span
                            style={{ fontWeight: 700, minWidth: "1.2rem", textAlign: "center" }}
                          >
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            className="action icon-btn"
                            style={{ minHeight: "32px", width: "32px", padding: 0 }}
                            onClick={() => onUpdateQuantity(index, item.quantity + 1)}
                            aria-label="Increase quantity"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          type="button"
                          className="icon-btn"
                          style={{
                            color: "var(--danger)",
                            border: "none",
                            background: "transparent",
                          }}
                          onClick={() => onRemoveItem(index)}
                          aria-label="Remove item"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {suggestions.length > 0 && onChooseSuggestion && (
                <section className="dining-cart-suggestions" aria-labelledby="dining-pair-title">
                  <div className="row between">
                    <h3 id="dining-pair-title">Complete your meal</h3>
                    <small>Selected by the restaurant</small>
                  </div>
                  <div className="dining-cart-suggestion-list">
                    {suggestions.map(({ dish, category, currency: suggestionCurrency, visual }) => (
                      <div className="dining-cart-suggestion" key={dish.id}>
                        <DiningImage visual={visual} />
                        <div>
                          <strong>{dish.name}</strong>
                          <small>
                            {dish.variants.length ? "From " : ""}
                            {formatPrice(startingPriceMinor(dish), suggestionCurrency)}
                          </small>
                        </div>
                        <button
                          type="button"
                          aria-label={"View " + dish.name + " and customize"}
                          onClick={() => {
                            setIsOpen(false);
                            onChooseSuggestion(dish, category);
                          }}
                        >
                          <Plus size={17} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              {/* Guest Details */}
              <div className="cart-section stack" style={{ gap: "0.5rem", marginTop: "0.5rem" }}>
                <span className="section-title">Your Details (Optional)</span>
                <div className="row" style={{ gap: "0.5rem" }}>
                  <input
                    type="text"
                    placeholder="Your Name"
                    value={customerName}
                    maxLength={80}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="field-input"
                    style={{ flex: 1 }}
                  />
                  <input
                    type="tel"
                    placeholder="Phone (Optional)"
                    value={customerPhone}
                    maxLength={30}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="field-input"
                    style={{ flex: 1 }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Order instructions or table notes..."
                  value={orderNotes}
                  maxLength={500}
                  onChange={(e) => setOrderNotes(e.target.value)}
                  className="field-input"
                />
              </div>

              {/* Price Breakdown */}
              <div className="panel quiet stack" style={{ gap: "0.3rem", marginTop: "0.5rem" }}>
                <div className="row between">
                  <span>Subtotal</span>
                  <span className="money">{formatPrice(subtotalMinor, currency)}</span>
                </div>
                <small className="quiet">
                  Item subtotal is estimated. The restaurant validates prices and any applicable
                  charges before accepting your order.
                </small>
                <div
                  className="row between"
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: "0.4rem",
                    fontWeight: 800,
                  }}
                >
                  <span>Estimated item subtotal</span>
                  <span className="money" style={{ fontSize: "1.2rem" }}>
                    {formatPrice(subtotalMinor, currency)}
                  </span>
                </div>
              </div>

              {/* Invariant Alert: Submission is not acceptance */}
              <div className="alert-notice stack" style={{ gap: "0.2rem" }}>
                <strong>Important Dining Information</strong>
                <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.4 }}>
                  Submitting your order sends it to the restaurant team; it does not mean they have
                  accepted it yet. Follow your tracking page for confirmation and the restaurant’s
                  instructions for payment.
                </p>
              </div>

              {errorMessage && (
                <div className="stack" role="alert">
                  <p className="error">{errorMessage}</p>
                  {errorMessage.toLowerCase().includes("price") && (
                    <button
                      type="button"
                      className="action"
                      onClick={() => {
                        onClearCart();
                        window.location.reload();
                      }}
                    >
                      Refresh menu and reset the outdated cart
                    </button>
                  )}
                </div>
              )}
              {pendingRecovery && (
                <div className="alert-notice stack" role="status">
                  <strong>Previous submission needs confirmation</strong>
                  <p>
                    We kept the original recovery key. Checking it cannot create a duplicate order.
                  </p>
                  <button
                    type="button"
                    className="action"
                    disabled={isSubmitting}
                    onClick={() => {
                      clearPendingGuestOrder(token);
                      setPendingRecovery(null);
                      setErrorMessage(null);
                    }}
                  >
                    Discard this attempt and edit the cart
                  </button>
                </div>
              )}
            </div>

            {/* Footer Submit Button */}
            <div className="cart-footer">
              <button
                type="button"
                className="action ember"
                style={{ width: "100%", minHeight: "50px", fontSize: "1.05rem" }}
                disabled={isSubmitting || items.length === 0}
                onClick={handleSubmitOrder}
              >
                {isSubmitting
                  ? "Checking your order..."
                  : pendingRecovery
                    ? "Check previous submission"
                    : `Submit order · ${formatPrice(subtotalMinor, currency)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
