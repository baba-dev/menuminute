"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingBag, X, Plus, Minus, Trash2, ArrowRight, Utensils, Package } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import type { CartItem } from "./item-customizer";

export function CartDrawer({
  items,
  currency,
  token,
  outletName,
  point,
  fulfillmentModes = ["dine_in"],
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionKeyRef = useRef<string>("");
  useEffect(() => {
    submissionKeyRef.current = "";
  }, [items, fulfillmentMode, customerName, customerPhone, orderNotes]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const subtotalMinor = items.reduce((sum, item) => sum + item.unitPriceMinor * item.quantity, 0);

  if (items.length === 0) return null;

  const handleSubmitOrder = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const clientSubmissionKey = submissionKeyRef.current || crypto.randomUUID();
      submissionKeyRef.current = clientSubmissionKey;

      const response = await fetch("/api/public-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          clientSubmissionKey,
          quotedTotalMinor: subtotalMinor,
          fulfillmentMode,
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
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to submit order. Please try again.");
      }

      onClearCart();
      setIsOpen(false);
      onOrderSubmitted({
        orderId: data.orderId,
        trackingToken: data.trackingToken,
        orderNumber: data.orderNumber,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Submission failed";
      setErrorMessage(message);
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
          <div className="cart-drawer stack">
            {/* Header */}
            <div className="cart-header row between">
              <div className="stack" style={{ gap: "0.2rem" }}>
                <span className="eyebrow">{outletName}</span>
                <h2 id="cart-drawer-title" style={{ margin: 0 }}>
                  Review Your Order
                </h2>
              </div>
              <button
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
                <div className="row between">
                  <span>Taxes</span>
                  <small className="quiet">Included in price</small>
                </div>
                <div
                  className="row between"
                  style={{
                    borderTop: "1px solid var(--line)",
                    paddingTop: "0.4rem",
                    fontWeight: 800,
                  }}
                >
                  <span>Total</span>
                  <span className="money" style={{ fontSize: "1.2rem" }}>
                    {formatPrice(subtotalMinor, currency)}
                  </span>
                </div>
              </div>

              {/* Invariant Alert: Submission is not acceptance */}
              <div className="alert-notice stack" style={{ gap: "0.2rem" }}>
                <strong>Important Dining Information</strong>
                <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: 1.4 }}>
                  Submitting your order sends it directly to our team. An order being submitted does
                  not mean the restaurant has accepted it yet. You will see live confirmation once
                  the kitchen acknowledges your ticket. Payment is completed at the counter.
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
                  ? "Sending to Kitchen..."
                  : `Send Order · ${formatPrice(subtotalMinor, currency)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
