import { describe, expect, it } from "vitest";
import { ValidationError } from "@/lib/errors";
import { priceLine, priceSelection, type PricedCombo } from "@/modules/tiffin/pricing";

const thali: PricedCombo = {
  id: "combo-thali",
  name: "Veg Thali",
  priceMinor: 12000n,
  addons: [{ id: "addon-roti", label: "Extra roti", priceMinor: 1000n }],
};
const snack: PricedCombo = { id: "combo-snack", name: "Snack Box", priceMinor: 8000n, addons: [] };

describe("priceLine", () => {
  it("prices a combo with an add-on", () => {
    const q = priceLine(thali, { comboId: "combo-thali", addonIds: ["addon-roti"], quantity: 3 });
    expect(q.unitMinor).toBe(13000n);
    expect(q.lineMinor).toBe(39000n);
    expect(q.name).toBe("Veg Thali");
    expect(q.quantity).toBe(3);
    expect(q.addons).toEqual([{ id: "addon-roti", label: "Extra roti", priceMinor: 1000n }]);
  });
  it("prices a combo without add-ons", () => {
    const q = priceLine(thali, { comboId: "combo-thali", addonIds: [], quantity: 2 });
    expect(q.unitMinor).toBe(12000n);
    expect(q.lineMinor).toBe(24000n);
  });
  it.each([0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])(
    "rejects quantity %s",
    (quantity) => {
      expect(() => priceLine(thali, { comboId: "combo-thali", addonIds: [], quantity })).toThrow(
        ValidationError
      );
    }
  );
  it("rejects duplicate and unknown add-ons", () => {
    expect(() =>
      priceLine(thali, {
        comboId: "combo-thali",
        addonIds: ["addon-roti", "addon-roti"],
        quantity: 1,
      })
    ).toThrow(ValidationError);
    expect(() =>
      priceLine(thali, { comboId: "combo-thali", addonIds: ["nope"], quantity: 1 })
    ).toThrow(ValidationError);
  });
  it("keeps large products exact", () => {
    const big: PricedCombo = { ...snack, priceMinor: 2147483647n };
    const q = priceLine(big, { comboId: "combo-snack", addonIds: [], quantity: 2147483647 });
    expect(q.lineMinor).toBe(2147483647n * 2147483647n);
  });
  it("rejects results above the bigint column limit", () => {
    const big: PricedCombo = { ...snack, priceMinor: 2n ** 62n };
    expect(() => priceLine(big, { comboId: "combo-snack", addonIds: [], quantity: 2 })).toThrow(
      ValidationError
    );
    const edge: PricedCombo = { ...snack, priceMinor: 2n ** 63n - 1n };
    expect(priceLine(edge, { comboId: "combo-snack", addonIds: [], quantity: 1 }).lineMinor).toBe(
      2n ** 63n - 1n
    );
  });
});

describe("priceSelection", () => {
  it("totals multiple lines", () => {
    const r = priceSelection(
      [thali, snack],
      [
        { comboId: "combo-thali", addonIds: ["addon-roti"], quantity: 3 },
        { comboId: "combo-snack", addonIds: [], quantity: 1 },
      ]
    );
    expect(r.lines.map((l) => l.lineMinor)).toEqual([39000n, 8000n]);
    expect(r.totalMinor).toBe(47000n);
  });
  it("rejects unknown combos, empty and oversized selections", () => {
    expect(() =>
      priceSelection([thali], [{ comboId: "ghost", addonIds: [], quantity: 1 }])
    ).toThrow(ValidationError);
    expect(() => priceSelection([thali], [])).toThrow(ValidationError);
    const many = Array.from({ length: 101 }, () => ({
      comboId: "combo-thali",
      addonIds: [],
      quantity: 1,
    }));
    expect(() => priceSelection([thali], many)).toThrow(ValidationError);
    expect(priceSelection([thali], many.slice(0, 100)).totalMinor).toBe(1_200_000n);
  });
  it("keeps a maximum safe quantity exact and rejects overflow", () => {
    const one: PricedCombo = { ...snack, priceMinor: 1000n };
    const r = priceSelection(
      [one],
      [{ comboId: "combo-snack", addonIds: [], quantity: Number.MAX_SAFE_INTEGER }]
    );
    expect(r.totalMinor).toBe(1000n * BigInt(Number.MAX_SAFE_INTEGER));
    const big: PricedCombo = { ...snack, priceMinor: 2147483647n };
    expect(() =>
      priceSelection(
        [big],
        Array.from({ length: 100 }, () => ({
          comboId: "combo-snack",
          addonIds: [],
          quantity: Number.MAX_SAFE_INTEGER,
        }))
      )
    ).toThrow(ValidationError);
  });
  it("rejects a total above the limit", () => {
    const big: PricedCombo = { ...snack, priceMinor: 2n ** 62n };
    expect(() =>
      priceSelection(
        [big],
        [
          { comboId: "combo-snack", addonIds: [], quantity: 1 },
          { comboId: "combo-snack", addonIds: [], quantity: 1 },
        ]
      )
    ).toThrow(ValidationError);
  });
});
