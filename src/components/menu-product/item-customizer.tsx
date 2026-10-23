"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { DiningImage } from "./dining-image";
import type { DiningVisual } from "@/modules/menu-product/public-presentation";
import { X, Plus, Minus, Leaf, Check } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export type CustomizerDish = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  mediaId: string | null;
  dietary: readonly string[];
  soldOut?: boolean;
  open?: boolean;
  variants: readonly { id: string; name: string; priceMinor: number; isAvailable: boolean }[];
  addOnGroups: readonly {
    id: string;
    name: string;
    min: number;
    max: number;
    options: readonly { id: string; name: string; priceMinor: number; isAvailable: boolean }[];
  }[];
};

export type CartItemOption = {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceMinor: number;
};

export type CartItem = {
  dishId: string;
  dishName: string;
  variantId: string | null;
  variantName: string | null;
  selectedAddOns: CartItemOption[];
  unitPriceMinor: number;
  quantity: number;
  itemNotes: string;
};

export function ItemCustomizer({
  dish,
  currency,
  visual,
  readOnly = false,
  isOpen,
  onClose,
  onAddToCart,
}: {
  dish: CustomizerDish | null;
  currency: string;
  visual?: DiningVisual | null;
  readOnly?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}) {
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(() => {
    if (!dish || dish.variants.length === 0) return null;
    const firstAvailable = dish.variants.find((v) => v.isAvailable);
    return firstAvailable ? firstAvailable.id : dish.variants[0]?.id || null;
  });

  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [quantity, setQuantity] = useState(1);
  const [itemNotes, setItemNotes] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    if (!isOpen) return;
    const prior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
      }
      if (event.key !== "Tab" || !sheetRef.current) return;
      const controls = Array.from(
        sheetRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
        )
      );
      if (!controls.length) return;
      const first = controls[0]!;
      const last = controls[controls.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      prior?.focus();
    };
  }, [isOpen]);

  // Re-initialize state when dish opens
  const activeDish = dish;

  const currentVariant = useMemo(() => {
    if (!activeDish || !selectedVariantId) return null;
    return activeDish.variants.find((v) => v.id === selectedVariantId) || null;
  }, [activeDish, selectedVariantId]);

  const basePrice = currentVariant ? currentVariant.priceMinor : (activeDish?.priceMinor ?? 0);

  const addOnsTotal = useMemo(() => {
    if (!activeDish) return 0;
    let sum = 0;
    for (const group of activeDish.addOnGroups) {
      const chosen = selectedOptions[group.id] || [];
      for (const optId of chosen) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) sum += opt.priceMinor;
      }
    }
    return sum;
  }, [activeDish, selectedOptions]);

  const unitTotal = basePrice + addOnsTotal;
  const grandTotal = unitTotal * quantity;

  if (!isOpen || !activeDish) return null;

  const handleToggleAddOn = (groupId: string, optionId: string, max: number) => {
    setSelectedOptions((prev) => {
      const current = prev[groupId] || [];
      const exists = current.includes(optionId);
      if (exists) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= max) {
        if (max === 1) {
          return { ...prev, [groupId]: [optionId] };
        }
        return prev;
      }
      return { ...prev, [groupId]: [...current, optionId] };
    });
    setValidationError(null);
  };

  const handleSubmit = () => {
    if (readOnly || activeDish.soldOut || activeDish.open === false) return;
    if (activeDish.variants.length > 0 && (!currentVariant || !currentVariant.isAvailable)) {
      setValidationError("Choose an available option.");
      return;
    }
    // Validate required variant
    if (activeDish.variants.length > 0 && !selectedVariantId) {
      setValidationError("Please select an option.");
      return;
    }

    // Validate required add-on groups
    for (const group of activeDish.addOnGroups) {
      const chosen = selectedOptions[group.id] || [];
      if (
        chosen.length < group.min ||
        chosen.length > group.max ||
        chosen.some(
          (optionId) =>
            !group.options.some((option) => option.id === optionId && option.isAvailable)
        )
      ) {
        setValidationError(`Please select at least ${group.min} choice(s) for "${group.name}".`);
        return;
      }
    }

    const flatOptions: CartItemOption[] = [];
    for (const group of activeDish.addOnGroups) {
      const chosen = selectedOptions[group.id] || [];
      for (const optId of chosen) {
        const opt = group.options.find((o) => o.id === optId);
        if (opt) {
          flatOptions.push({
            groupId: group.id,
            groupName: group.name,
            optionId: opt.id,
            optionName: opt.name,
            priceMinor: opt.priceMinor,
          });
        }
      }
    }

    onAddToCart({
      dishId: activeDish.id,
      dishName: activeDish.name,
      variantId: currentVariant ? currentVariant.id : null,
      variantName: currentVariant ? currentVariant.name : null,
      selectedAddOns: flatOptions,
      unitPriceMinor: unitTotal,
      quantity,
      itemNotes: itemNotes.trim(),
    });

    onClose();
  };

  return (
    <div
      className="customizer-overlay dining-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="customizer-title"
    >
      <div className="customizer-sheet stack" ref={sheetRef}>
        {visual && (
          <div className="dining-customizer-photo">
            <DiningImage visual={visual} eager />
          </div>
        )}
        <div className="customizer-header row between">
          <div className="stack" style={{ gap: "0.2rem" }}>
            <span className="eyebrow">{readOnly ? "From our kitchen" : "Make it yours"}</span>
            <h2 id="customizer-title" style={{ margin: 0 }}>
              {activeDish.name}
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="icon-btn"
            onClick={onClose}
            aria-label="Close customizer"
            style={{ borderRadius: "50%", padding: "0.4rem", minHeight: "36px", width: "36px" }}
          >
            <X size={18} />
          </button>
        </div>

        <div className="customizer-body stack">
          {activeDish.description && (
            <p className="quiet" style={{ fontSize: "0.95rem" }}>
              {activeDish.description}
            </p>
          )}

          {activeDish.dietary.length > 0 && (
            <div className="row" style={{ gap: "0.4rem" }}>
              {activeDish.dietary.map((d) => (
                <span key={d} className="badge">
                  <Leaf size={12} style={{ display: "inline" }} /> {d.replaceAll("_", " ")}
                </span>
              ))}
            </div>
          )}

          {/* Variants section */}
          {readOnly && (
            <p className="dining-detail-hint">
              Browse the available options and pricing. Ask the restaurant team to order.
            </p>
          )}
          {activeDish.variants.length > 0 && (
            <div className="customizer-section stack">
              <div className="row between">
                <span className="section-title">Select Size / Style</span>
                <span className="badge">Required</span>
              </div>
              <div className="options-list stack" style={{ gap: "0.5rem" }}>
                {activeDish.variants.map((v) => {
                  const isSelected = selectedVariantId === v.id;
                  return (
                    <label
                      key={v.id}
                      className={`option-card row between ${isSelected ? "selected" : ""} ${!v.isAvailable ? "disabled" : ""}`}
                    >
                      <div className="row" style={{ gap: "0.6rem" }}>
                        <input
                          type="radio"
                          name="variant"
                          value={v.id}
                          checked={isSelected}
                          disabled={!v.isAvailable || readOnly}
                          onChange={() => {
                            setSelectedVariantId(v.id);
                            setValidationError(null);
                          }}
                        />
                        <span>
                          {v.name} {!v.isAvailable && "(Sold out)"}
                        </span>
                      </div>
                      <span className="money">{formatPrice(v.priceMinor, currency)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Add-on groups section */}
          {activeDish.addOnGroups.map((g) => {
            const chosen = selectedOptions[g.id] || [];
            return (
              <div key={g.id} className="customizer-section stack">
                <div className="row between">
                  <div>
                    <span className="section-title">{g.name}</span>
                    <small className="quiet" style={{ display: "block" }}>
                      {g.min > 0 ? `Select at least ${g.min}` : "Optional"} · Max {g.max}
                    </small>
                  </div>
                  {g.min > 0 && chosen.length < g.min && (
                    <span className="badge" style={{ color: "var(--ember)" }}>
                      Required
                    </span>
                  )}
                  {chosen.length >= g.min && (
                    <span className="badge" style={{ color: "var(--success)" }}>
                      <Check size={12} style={{ display: "inline" }} /> Ready
                    </span>
                  )}
                </div>
                <div className="options-list stack" style={{ gap: "0.5rem" }}>
                  {g.options.map((opt) => {
                    const isChecked = chosen.includes(opt.id);
                    return (
                      <label
                        key={opt.id}
                        className={`option-card row between ${isChecked ? "selected" : ""} ${!opt.isAvailable ? "disabled" : ""}`}
                      >
                        <div className="row" style={{ gap: "0.6rem" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!opt.isAvailable || readOnly}
                            onChange={() => handleToggleAddOn(g.id, opt.id, g.max)}
                          />
                          <span>
                            {opt.name} {!opt.isAvailable && "(Sold out)"}
                          </span>
                        </div>
                        <span className="money">
                          {opt.priceMinor > 0
                            ? `+${formatPrice(opt.priceMinor, currency)}`
                            : "Free"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Cooking notes input */}
          {!readOnly && (
            <div className="customizer-section stack">
              <span className="section-title">Special Instructions</span>
              <input
                type="text"
                placeholder="e.g. Less spicy, dressing on side, allergies"
                value={itemNotes}
                maxLength={200}
                onChange={(e) => setItemNotes(e.target.value)}
                className="field-input"
              />
            </div>
          )}
          {validationError && (
            <p className="error" role="alert" style={{ margin: "0.2rem 0" }}>
              {validationError}
            </p>
          )}
        </div>

        {/* Customizer footer with quantity stepper and add to cart button */}
        <div className="customizer-footer row between">
          {readOnly ? (
            <button
              type="button"
              className="action ember"
              style={{ width: "100%" }}
              onClick={onClose}
            >
              Back to menu
            </button>
          ) : (
            <>
              <div className="stepper row" style={{ gap: "0.5rem", alignItems: "center" }}>
                <button
                  type="button"
                  className="action icon-btn"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span style={{ fontWeight: 700, minWidth: "1.5rem", textAlign: "center" }}>
                  {quantity}
                </span>
                <button
                  type="button"
                  className="action icon-btn"
                  onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>

              <button
                type="button"
                className="action ember"
                style={{ flex: 1, minHeight: "48px", marginLeft: "1rem" }}
                onClick={handleSubmit}
              >
                Add to Order · {formatPrice(grandTotal, currency)}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
