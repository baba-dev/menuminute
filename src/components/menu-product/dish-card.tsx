"use client";
import { ArrowUpRight, Flame, Leaf, Plus, ShieldAlert, Star } from "lucide-react";
import { DiningImage } from "./dining-image";
import { hasVerifiedNutrition } from "@/modules/menu-product/culinary-safety";
import { dishVisual } from "@/modules/menu-product/public-presentation";
import { getSpicePresentation } from "@/modules/menu-product/spice-presentation";
import { formatPrice } from "@/lib/utils";
import { RubberStamp } from "@/components/ui/tactile-elements";
import type { CustomizerDish } from "./item-customizer";

/** Verified-order rating aggregate. Supplied by the reviews slice; absent until then. */
export type DishRating = { average: number; count: number };

export function DishCard({
  dish,
  image,
  priceMinor,
  currency,
  browseOnly,
  rating,
  onOpen,
}: {
  dish: CustomizerDish;
  image: ReturnType<typeof dishVisual>;
  priceMinor: number;
  currency: string;
  browseOnly: boolean;
  rating?: DishRating | null;
  onOpen: () => void;
}) {
  const unavailable = dish.soldOut || !dish.open;
  const customizable = dish.variants.length + dish.addOnGroups.length > 0;
  const spice = getSpicePresentation(dish.culinary?.spiceLevel);
  const showRating = rating && rating.count > 0;
  const allergenCount = dish.safety?.verified ? (dish.safety.allergens?.length ?? 0) : 0;
  return (
    <article className={"dining-dish " + (unavailable ? "is-unavailable" : "")}>
      <button
        type="button"
        className="dining-photo-button"
        onClick={onOpen}
        aria-label={"View " + dish.name + " details"}
      >
        <DiningImage visual={image} />
        {dish.soldOut && (
          <RubberStamp
            text="Sold Out"
            variant="sold-out"
            className="dining-sold !border-solid shadow-sm"
          />
        )}
      </button>
      <div className="dining-dish-content">
        <div className="dining-dish-title">
          <h3>{dish.name}</h3>
          <strong>
            {dish.variants.length ? "From " : ""}
            {formatPrice(priceMinor, currency)}
          </strong>
        </div>
        {showRating && (
          <p
            className="dining-rating"
            aria-label={`Rated ${rating.average.toFixed(1)} out of 5 from ${rating.count} verified ${
              rating.count === 1 ? "order" : "orders"
            }`}
          >
            <Star size={13} aria-hidden="true" fill="currentColor" />
            <span aria-hidden="true">
              {rating.average.toFixed(1)} <small>({rating.count})</small>
            </span>
          </p>
        )}
        {dish.description && <p>{dish.description}</p>}
        <div className="dining-tags">
          {dish.dietary.map((value) => (
            <span key={value}>
              <Leaf size={12} aria-hidden="true" />
              {value.replaceAll("_", " ")}
            </span>
          ))}
          {spice && (
            <span className="dining-spice-pill">
              <Flame size={12} aria-hidden="true" className="ember-text" />
              {spice.label}
            </span>
          )}
          {hasVerifiedNutrition(dish.nutrition) && dish.nutrition?.calories !== undefined && (
            <span className="dining-calorie-pill">{dish.nutrition.calories} kcal</span>
          )}
          {allergenCount > 0 && (
            <span className="dining-allergen-pill-card">
              <ShieldAlert size={12} aria-hidden="true" />
              {allergenCount} allergen
              {allergenCount === 1 ? "" : "s"}
            </span>
          )}
          {customizable && <span>Customizable</span>}
          {!dish.open && <span>Outside service time</span>}
        </div>
        <button
          type="button"
          className={"dining-dish-cta " + (unavailable || browseOnly ? "is-quiet" : "")}
          disabled={unavailable && !browseOnly}
          onClick={onOpen}
        >
          {browseOnly
            ? "View dish"
            : unavailable
              ? "Unavailable"
              : customizable
                ? "Customize & add"
                : "Add to order"}
          {browseOnly ? (
            <ArrowUpRight size={17} aria-hidden="true" />
          ) : (
            <Plus size={17} aria-hidden="true" />
          )}
        </button>
      </div>
    </article>
  );
}
