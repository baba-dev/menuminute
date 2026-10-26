"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { DiningImage } from "./dining-image";
import type { DiningVisual } from "@/modules/menu-product/public-presentation";
import { X, Plus, Minus, Leaf, Check, Flame, ShieldAlert, Sparkles, ChefHat } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { MAX_ITEM_QUANTITY } from "@/modules/orders/guest-checkout";
import { canQuickAddCompanion, hasVerifiedNutrition } from "@/modules/menu-product/culinary-safety";

export type CustomizerDish = {
  id: string;
  name: string;
  description: string;
  priceMinor: number;
  mediaId: string | null;
  dietary: readonly string[];
  nutrition?: {
    calories?: number;
    proteinGrams?: number;
    carbsGrams?: number;
    fatGrams?: number;
    fiberGrams?: number;
    servingSize?: string;
    verified?: boolean;
  };
  culinary?: {
    spiceLevel?: number;
    flavorNotes?: readonly string[];
    chefNote?: string;
    servingTemp?: "hot" | "chilled" | "ambient";
    pairingDishIds?: readonly string[];
  };
  safety?: {
    ingredients?: readonly string[];
    allergens?: readonly string[];
    crossContact?: string;
    verified?: boolean;
    verifiedFreeFrom?: readonly ("nuts" | "dairy")[];
  };
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

const ALLERGEN_LABELS: Record<string, string> = {
  dairy: "Dairy",
  gluten: "Gluten / Wheat",
  nuts: "Tree Nuts",
  peanuts: "Peanuts",
  eggs: "Eggs",
  soy: "Soy",
  fish: "Fish",
  shellfish: "Crustaceans / Shellfish",
  sesame: "Sesame",
  mustard: "Mustard",
  sulfites: "Sulfites",
};

const SPICE_DESCRIPTIONS: Record<number, string> = {
  0: "No Heat",
  1: "Mild Heat 🔥",
  2: "Medium Heat 🔥🔥",
  3: "Hot 🔥🔥🔥",
  4: "Extra Fiery 🔥🔥🔥🔥",
};

export function ItemCustomizer({
  dish,
  currency,
  visual,
  readOnly = false,
  isOpen,
  companionDishes = [],
  onSelectCompanion,
  onClose,
  onAddToCart,
}: {
  dish: CustomizerDish | null;
  currency: string;
  visual?: DiningVisual | null;
  readOnly?: boolean;
  isOpen: boolean;
  companionDishes?: CustomizerDish[];
  onSelectCompanion?: (companion: CustomizerDish) => void;
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
  const [addedCompanions, setAddedCompanions] = useState<Set<string>>(() => new Set());
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
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

          <div className="row wrap" style={{ gap: "0.4rem" }}>
            {activeDish.dietary.map((d) => (
              <span key={d} className="badge dining-dietary-badge">
                <Leaf size={12} style={{ display: "inline" }} /> {d.replaceAll("_", " ")}
              </span>
            ))}
            {activeDish.culinary?.spiceLevel !== undefined &&
              activeDish.culinary.spiceLevel > 0 && (
                <span className="badge dining-spice-badge">
                  <Flame size={12} style={{ display: "inline" }} />{" "}
                  {SPICE_DESCRIPTIONS[activeDish.culinary.spiceLevel] ??
                    `${activeDish.culinary.spiceLevel} Heat`}
                </span>
              )}
            {activeDish.culinary?.servingTemp && (
              <span className="badge dining-temp-badge">
                Served {activeDish.culinary.servingTemp}
              </span>
            )}
          </div>

          {/* Chef Tasting Note / Heritage Story */}
          {activeDish.culinary?.chefNote && (
            <div className="dining-chef-note stack">
              <div className="row" style={{ gap: "0.4rem", alignItems: "center" }}>
                <ChefHat size={16} className="ember-text" />
                <span className="eyebrow" style={{ fontSize: "0.75rem", letterSpacing: "0.08em" }}>
                  Chef&apos;s Tasting Note
                </span>
              </div>
              <p
                style={{ margin: 0, fontStyle: "italic", fontSize: "0.92rem", lineHeight: "1.45" }}
              >
                &ldquo;{activeDish.culinary.chefNote}&rdquo;
              </p>
            </div>
          )}

          {/* Flavor Profile Tags */}
          {activeDish.culinary?.flavorNotes && activeDish.culinary.flavorNotes.length > 0 && (
            <div className="stack" style={{ gap: "0.4rem" }}>
              <span className="section-title" style={{ fontSize: "0.85rem" }}>
                Flavor & Sensation
              </span>
              <div className="row wrap" style={{ gap: "0.35rem" }}>
                {activeDish.culinary.flavorNotes.map((note) => (
                  <span key={note} className="dining-flavor-tag">
                    {note}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Nutritional Values & Macros */}
          {hasVerifiedNutrition(activeDish.nutrition) && (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <div className="row between">
                <span className="section-title" style={{ fontSize: "0.85rem" }}>
                  Nutritional Profile
                </span>
                {activeDish.nutrition?.servingSize && (
                  <span className="quiet" style={{ fontSize: "0.8rem" }}>
                    {activeDish.nutrition.servingSize}
                  </span>
                )}
              </div>
              <div className="dining-macro-grid">
                {activeDish.nutrition?.calories !== undefined && (
                  <div className="dining-macro-card">
                    <span className="dining-macro-val">{activeDish.nutrition.calories}</span>
                    <span className="dining-macro-lbl">kcal</span>
                  </div>
                )}
                {activeDish.nutrition?.proteinGrams !== undefined && (
                  <div className="dining-macro-card">
                    <span className="dining-macro-val">{activeDish.nutrition.proteinGrams}g</span>
                    <span className="dining-macro-lbl">Protein</span>
                  </div>
                )}
                {activeDish.nutrition?.carbsGrams !== undefined && (
                  <div className="dining-macro-card">
                    <span className="dining-macro-val">{activeDish.nutrition.carbsGrams}g</span>
                    <span className="dining-macro-lbl">Carbs</span>
                  </div>
                )}
                {activeDish.nutrition?.fatGrams !== undefined && (
                  <div className="dining-macro-card">
                    <span className="dining-macro-val">{activeDish.nutrition.fatGrams}g</span>
                    <span className="dining-macro-lbl">Fat</span>
                  </div>
                )}
                {activeDish.nutrition?.fiberGrams !== undefined && (
                  <div className="dining-macro-card">
                    <span className="dining-macro-val">{activeDish.nutrition.fiberGrams}g</span>
                    <span className="dining-macro-lbl">Fiber</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ingredients & Allergen Transparency */}
          {activeDish.safety?.verified &&
            (Boolean(activeDish.safety.ingredients?.length) ||
              Boolean(activeDish.safety.allergens?.length) ||
              Boolean(activeDish.safety.crossContact)) && (
              <div className="stack" style={{ gap: "0.6rem" }}>
                <span className="section-title" style={{ fontSize: "0.85rem" }}>
                  Ingredients & Allergens
                </span>

                {activeDish.safety?.ingredients && activeDish.safety.ingredients.length > 0 && (
                  <p
                    className="quiet"
                    style={{ fontSize: "0.88rem", margin: 0, lineHeight: "1.4" }}
                  >
                    <strong style={{ color: "var(--dc-ink)" }}>Ingredients:</strong>{" "}
                    {activeDish.safety.ingredients.join(", ")}.
                  </p>
                )}

                {activeDish.safety?.allergens && activeDish.safety.allergens.length > 0 && (
                  <div className="dining-allergen-alert">
                    <div className="row" style={{ gap: "0.4rem", alignItems: "center" }}>
                      <ShieldAlert size={16} className="dining-alert-icon" />
                      <strong>Contains Allergens:</strong>
                    </div>
                    <div className="row wrap" style={{ gap: "0.35rem", marginTop: "0.4rem" }}>
                      {activeDish.safety.allergens.map((a) => (
                        <span key={a} className="dining-allergen-pill">
                          {ALLERGEN_LABELS[a] ?? a}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {activeDish.safety?.crossContact && (
                  <div className="dining-allergen-alert" role="note">
                    <ShieldAlert size={16} aria-hidden="true" />
                    <strong>Cross-contact notice:</strong> {activeDish.safety.crossContact}
                  </div>
                )}
              </div>
            )}
          {!activeDish.safety?.verified && (
            <p className="quiet" role="note">
              Ingredient and allergen details have not been verified by this restaurant. Ask staff
              before ordering if you have an allergy.
            </p>
          )}

          {/* Chef Recommended Pairings */}
          {companionDishes && companionDishes.length > 0 && (
            <div className="stack" style={{ gap: "0.5rem" }}>
              <div className="row" style={{ gap: "0.4rem", alignItems: "center" }}>
                <Sparkles size={15} className="ember-text" />
                <span className="section-title" style={{ fontSize: "0.85rem" }}>
                  Chef Recommended Pairings
                </span>
              </div>
              <div className="dining-pairings-strip">
                {companionDishes.map((comp) => {
                  const quickAddEligible = canQuickAddCompanion(comp);
                  const hasRequiredCustomization = !quickAddEligible;
                  const isQuickAdded = addedCompanions.has(comp.id);

                  return (
                    <div key={comp.id} className="dining-pairing-card">
                      <span className="dining-pairing-name">{comp.name}</span>
                      <span className="dining-pairing-price">
                        {comp.variants.length > 0 ? "From " : ""}
                        {formatPrice(
                          comp.variants.length
                            ? Math.min(
                                ...comp.variants
                                  .filter((v) => v.isAvailable)
                                  .map((v) => v.priceMinor)
                              )
                            : comp.priceMinor,
                          currency
                        )}
                      </span>
                      <div className="row wrap" style={{ gap: "0.3rem", marginTop: "auto" }}>
                        {!readOnly && quickAddEligible && (
                          <button
                            type="button"
                            className={`dining-pairing-btn ${isQuickAdded ? "is-added" : ""}`}
                            disabled={isQuickAdded}
                            onClick={() => {
                              onAddToCart({
                                dishId: comp.id,
                                dishName: comp.name,
                                variantId: null,
                                variantName: null,
                                selectedAddOns: [],
                                unitPriceMinor: comp.priceMinor,
                                quantity: 1,
                                itemNotes: "",
                              });
                              setAddedCompanions((prev) => new Set(prev).add(comp.id));
                            }}
                          >
                            {isQuickAdded ? (
                              <>
                                <Check size={12} style={{ display: "inline" }} /> Added
                              </>
                            ) : (
                              "+ Quick Add"
                            )}
                          </button>
                        )}
                        <button
                          type="button"
                          className="dining-pairing-btn is-secondary"
                          onClick={() => onSelectCompanion?.(comp)}
                        >
                          {hasRequiredCustomization ? "Customize →" : "View"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
                  onClick={() => setQuantity((q) => Math.min(MAX_ITEM_QUANTITY, q + 1))}
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
