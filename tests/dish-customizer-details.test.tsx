// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  ItemCustomizer,
  type CustomizerDish,
} from "../src/components/menu-product/item-customizer";

const dish: CustomizerDish = {
  id: "dish-diner-profile",
  name: "Paneer in Sauce",
  description: "Slow-simmered paneer with herbs.",
  priceMinor: 25000,
  mediaId: null,
  dietary: ["vegetarian"],
  culinary: {
    spiceLevel: 5,
    chefNote: "Our kitchen uses a slow simmer.",
    flavorNotes: ["Smoky", "Tangy"],
    servingTemp: "hot",
  },
  nutrition: { calories: 420, proteinGrams: 19, verified: true, servingSize: "250g" },
  safety: {
    ingredients: ["Paneer", "Tomato"],
    allergens: ["dairy"],
    verified: true,
  },
  variants: [],
  addOnGroups: [],
};

function openDish(value: CustomizerDish, onAddToCart = vi.fn()) {
  return render(
    <ItemCustomizer
      dish={value}
      isOpen
      currency="INR"
      onClose={vi.fn()}
      onAddToCart={onAddToCart}
    />
  );
}

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("guest dish popup culinary information", () => {
  it("shows one kitchen note, five chillies and only verified safety and nutrition details", () => {
    const add = vi.fn();
    openDish(dish, add);
    expect(screen.getByText("Our kitchen uses a slow simmer.")).toBeTruthy();
    expect(screen.getAllByText("Our kitchen uses a slow simmer.")).toHaveLength(1);
    expect(screen.queryByText(/Chef's Tasting Note/)).toBeNull();
    expect(screen.getByRole("img", { name: "Heat: 5 of 5 chillies (Scorching)" })).toBeTruthy();
    expect(screen.getByText("420")).toBeTruthy();
    expect(screen.getByText("Paneer, Tomato.")).toBeTruthy();
    expect(screen.getByText("Dairy")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Add to Order/ }));
    expect(add).toHaveBeenCalledWith(
      expect.objectContaining({
        dishId: dish.id,
        unitPriceMinor: dish.priceMinor,
        quantity: 1,
      })
    );
  });

  it("hides unverified ingredient and nutrition claims without blocking ordering", () => {
    openDish({
      ...dish,
      nutrition: { calories: 420, verified: false },
      safety: { ingredients: ["Paneer"], allergens: ["dairy"], verified: false },
    });
    expect(screen.queryByText("420")).toBeNull();
    expect(screen.queryByText("Paneer.")).toBeNull();
    expect(screen.queryByText("Contains Allergens:")).toBeNull();
    expect(screen.getByText(/details have not been verified/)).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add to Order/ })).toBeTruthy();
  });
});
