"use client";

import { useEffect, useRef } from "react";
import { Leaf, X } from "lucide-react";
import type { MenuDocument } from "@/modules/menu-product/contracts";
import { formatPrice } from "@/lib/utils";
import { EmberButton } from "./phase4-primitives";

type Dish = MenuDocument["categories"][number]["items"][number] & { open: boolean };
/**
 * Editorial information surface, separate from the existing authorized Add/customizer path.
 * Showing item information must not manufacture an order, quote, tax or paid entitlement.
 */
export function DishDetail({
  dish,
  currency,
  onClose,
}: {
  dish: Dish;
  currency: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  const availableVariants = dish.variants.filter((v) => v.isAvailable);
  const displayedPrice = availableVariants.length
    ? Math.min(...availableVariants.map((v) => v.priceMinor))
    : dish.priceMinor;
  return (
    <dialog ref={ref} className="dish-detail" aria-labelledby="dish-detail-title" onClose={onClose}>
      <div className="dish-detail-content">
        <div className="dish-detail-art">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={
              dish.mediaId
                ? `/api/public-media/${dish.mediaId}?size=thumb`
                : "/icons/category-default.svg"
            }
            alt={dish.mediaId ? dish.name : "Dish illustration"}
            onError={(e) => {
              e.currentTarget.onerror = null;
              e.currentTarget.src = "/icons/category-default.svg";
            }}
            width={480}
            height={360}
          />
          {dish.soldOut && <span className="sold-label">Sold Out</span>}
        </div>
        <div className="stack dish-detail-copy">
          <div className="row between">
            <span className="eyebrow">From this kitchen</span>
            <button
              className="dish-close"
              type="button"
              aria-label="Close dish details"
              onClick={() => ref.current?.close()}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <h2 id="dish-detail-title">{dish.name}</h2>
          <p>
            {dish.description || "Ask the restaurant team for more information about this dish."}
          </p>
          <strong className="dish-detail-price">
            {availableVariants.length ? "From " : ""}
            {formatPrice(displayedPrice, currency)}
          </strong>
          <div className="row">
            {dish.dietary.map((v) => (
              <span className="badge" key={v}>
                <Leaf size={13} aria-hidden="true" /> {v.replaceAll("_", " ")}
              </span>
            ))}
          </div>
          {(dish.variants.length > 0 || dish.addOnGroups.length > 0) && (
            <div className="stack dish-detail-options">
              {dish.variants.length > 0 && (
                <section aria-label="Available variants">
                  <h3>Sizes and variants</h3>
                  {dish.variants.map((v) => (
                    <p key={v.id} className="row between">
                      <span>
                        {v.name}
                        {!v.isAvailable ? " · Sold Out" : ""}
                      </span>
                      <span className="money">{formatPrice(v.priceMinor, currency)}</span>
                    </p>
                  ))}
                </section>
              )}
              {dish.addOnGroups.map((g) => (
                <section key={g.id} aria-label={g.name}>
                  <h3>{g.name}</h3>
                  <p className="quiet">
                    Choose {g.min}–{g.max} for this dish.
                  </p>
                  {g.options.map((o) => (
                    <p className="row between" key={o.id}>
                      <span>
                        {o.name}
                        {!o.isAvailable ? " · Sold Out" : ""}
                      </span>
                      <span className="money">+{formatPrice(o.priceMinor, currency)}</span>
                    </p>
                  ))}
                </section>
              ))}
            </div>
          )}
          {!dish.open && <p className="error">Outside this dish’s service hours.</p>}
          <p className="dish-detail-disclaimer">
            Prices and dietary labels are supplied by the restaurant. Ask staff about allergens; if
            online ordering is enabled, use Add on the menu to customize.
          </p>
          <EmberButton intent="flow" onClick={() => ref.current?.close()}>
            Back to menu
          </EmberButton>
        </div>
      </div>
    </dialog>
  );
}
