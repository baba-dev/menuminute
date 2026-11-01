// @vitest-environment jsdom
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CAPABILITY_CARDS,
  CURRENCY_SAMPLES,
  SAMPLE_DISHES,
  arrangeDishes,
  formatInr,
  sampleDish,
} from "@/components/marketing/scan-to-order/scan-to-order-fixture";
import {
  cartTotals,
  changeCart,
  flipDelta,
  rollColumns,
  spotlightVars,
  tiltFor,
} from "@/components/marketing/scan-to-order/scan-to-order-motion";

const box = { left: 100, top: 100, width: 200, height: 400 };

describe("scan-to-order motion helpers", () => {
  it("tilts toward the pointer and is flat at the centre", () => {
    expect(tiltFor({ x: 200, y: 300 }, box)).toEqual({ rx: 0, ry: 0 });
    expect(tiltFor({ x: 300, y: 100 }, box, 10)).toEqual({ rx: 10, ry: 10 });
    expect(tiltFor({ x: -999, y: 9999 }, box, 10)).toEqual({ rx: -10, ry: -10 });
    expect(tiltFor({ x: 0, y: 0 }, { ...box, width: 0 })).toEqual({ rx: 0, ry: 0 });
  });

  it("maps the pointer to spotlight percentages inside the card", () => {
    expect(spotlightVars({ x: 200, y: 300 }, box)).toEqual({ mx: "50%", my: "50%" });
    expect(spotlightVars({ x: 0, y: 9999 }, box)).toEqual({ mx: "0%", my: "100%" });
  });

  it("computes the FLIP inverse from the old position", () => {
    const from = { left: 0, top: 120, width: 0, height: 0 };
    const to = { left: 0, top: 40, width: 0, height: 0 };
    expect(flipDelta(from, to)).toEqual({ x: 0, y: 80 });
  });

  it("splits a price into digit columns and glyphs", () => {
    expect(rollColumns("₹1,299")).toEqual([
      { kind: "glyph", glyph: "₹" },
      { kind: "digit", digit: 1 },
      { kind: "glyph", glyph: "," },
      { kind: "digit", digit: 2 },
      { kind: "digit", digit: 9 },
      { kind: "digit", digit: 9 },
    ]);
  });

  it("adds, removes and caps basket quantities", () => {
    let cart = changeCart([], "a", 2);
    cart = changeCart(cart, "b", 1);
    cart = changeCart(cart, "a", 1);
    expect(cart.find((l) => l.dishId === "a")?.quantity).toBe(3);
    cart = changeCart(cart, "b", -5);
    expect(cart.map((l) => l.dishId)).toEqual(["a"]);
    expect(changeCart(cart, "a", 999)[0]?.quantity).toBe(20);
    const price = (id: string) => (id === "a" ? 1000 : 0);
    expect(cartTotals(cart, price)).toEqual({ count: 3, totalMinor: 3000 });
  });
});

describe("scan-to-order fixture", () => {
  it("never marks a sample dish as verified or makes dietary claims", () => {
    for (const dish of SAMPLE_DISHES) {
      expect(dish.verified).toBe(false);
      expect(`${dish.name} ${dish.blurb}`).not.toMatch(
        /vegan|vegetarian|gluten|halal|allergen[- ]free|nut[- ]free|dairy[- ]free/i
      );
    }
  });

  it("uses the demo outlet's unit prices", () => {
    expect(sampleDish("MM-CORE-butter-chicken")?.priceMinor).toBe(39900);
    expect(sampleDish("MM-CORE-biryani")?.priceMinor).toBe(27900);
    expect(formatInr(39900)).toMatch(/399/);
  });

  it("filters by category and sorts", () => {
    expect(arrangeDishes("all", "popular").map((d) => d.popularity)).toEqual([1, 2, 3, 4]);
    const byPrice = arrangeDishes("all", "price").map((d) => d.priceMinor);
    expect(byPrice).toEqual([...byPrice].sort((a, b) => a - b));
    expect(arrangeDishes("mains", "popular").every((d) => d.category === "mains")).toBe(true);
  });

  it("does not call live ordering 'in development'", () => {
    const text = CAPABILITY_CARDS.map((card) => `${card.title} ${card.body}`).join(" ");
    expect(text).not.toMatch(/in development|coming soon|planned/i);
  });

  it("has distinct currency samples", () => {
    expect(new Set(CURRENCY_SAMPLES.map((c) => c.code)).size).toBe(CURRENCY_SAMPLES.length);
  });

  it("links every capability card to an existing public page", () => {
    for (const card of CAPABILITY_CARDS) {
      expect(card.href.startsWith("/")).toBe(true);
      const route = card.href.split("#")[0]!.replace(/^\//, "");
      expect(existsSync(join(process.cwd(), "src/app", route, "page.tsx")), card.href).toBe(true);
    }
  });
});
