// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { CartDrawer } from "../src/components/menu-product/cart-drawer";
import type { CartItem } from "../src/components/menu-product/item-customizer";

const item: CartItem = {
  dishId: "dish-mobile",
  dishName: "Test dish",
  variantId: null,
  variantName: null,
  selectedAddOns: [],
  unitPriceMinor: 21900,
  quantity: 1,
  itemNotes: "",
};

function CartHarness() {
  const [items, setItems] = useState<CartItem[]>([item]);
  return (
    <>
      <button onClick={() => setItems([item])}>Add another dish</button>
      <button onClick={() => setItems([])}>Clear externally</button>
      <CartDrawer
        items={items}
        currency="INR"
        token="mobile-test-menu"
        outletName="Test kitchen"
        point={null}
        timezone="Asia/Kolkata"
        onUpdateQuantity={(index, quantity) =>
          setItems((current) =>
            current
              .map((entry, i) => (i === index ? { ...entry, quantity } : entry))
              .filter((entry) => entry.quantity > 0)
          )
        }
        onRemoveItem={(index) => setItems((current) => current.filter((_, i) => i !== index))}
        onClearCart={() => setItems([])}
        onOrderSubmitted={vi.fn()}
      />
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  // Keep the quote pending: cart editing must work independently of the network.
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise<Response>(() => {}))
  );
  document.body.style.overflow = "auto";
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  document.body.style.overflow = "";
});

describe("diner cart recovery", () => {
  it.each(["Remove item", "Decrease quantity"])(
    "unlocks scrolling after %s empties the cart and keeps the next cart closed",
    (action) => {
      render(<CartHarness />);
      fireEvent.click(screen.getByRole("button", { name: /View Your Order/ }));
      expect(document.body.style.overflow).toBe("hidden");
      fireEvent.click(screen.getByRole("button", { name: action }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("auto");

      fireEvent.click(screen.getByRole("button", { name: "Add another dish" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: /View Your Order/ }));
      expect(screen.getByRole("dialog")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Close cart" }));
      expect(document.body.style.overflow).toBe("auto");
    }
  );

  it("releases the lock when the parent clears an open cart", () => {
    render(<CartHarness />);
    fireEvent.click(screen.getByRole("button", { name: /View Your Order/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear externally" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.body.style.overflow).toBe("auto");
  });
});
