import { describe, expect, it } from "vitest";
import { quotePublishedSelection } from "../src/modules/orders/quote";
import { menuDocumentSchema } from "../src/modules/menu-product/contracts";
import type { PublicProduct } from "../src/modules/menu-product/service";
const makeMenu = (currency = "INR"): PublicProduct => ({
  outlet: {
    name: "Kitchen", currency, timezone: "Asia/Kolkata", outletType: "restaurant",
    fulfillmentModes: ["dine_in", "pickup"], isDemoData: false, versioned: true,
  },
  point: "Table 8",
  now: "2026-10-18T12:00:00+05:30",
  menus: [{
    id: "release-1", revision: 4, brand: null, overrides: [],
    document: menuDocumentSchema.parse({
      name: "Lunch", currency, categories: [{ id: "main", name: "Mains", items: [
        { id: "paneer", name: "Paneer", priceMinor: 12000, variants: [
          { id: "small", name: "Small", priceMinor: 12000 },
          { id: "large", name: "Large", priceMinor: 16000 },
        ], addOnGroups: [
          { id: "bread", name: "Bread", min: 1, max: 2, options: [
            { id: "naan", name: "Naan", priceMinor: 1500 },
            { id: "roti", name: "Roti", priceMinor: 1000 },
          ]},
        ]},
      ]}],
    }),
  }],
});
const input = () => ({
  menuId: "release-1", expectedRevision: 4, lines: [{
    dishId: "paneer", variantId: "large", groups: [{ groupId: "bread", optionIds: ["naan"] }],
    quantity: 2,
  }],
});
const now = new Date("2026-10-18T12:00:00+05:30");
describe("canonical published selection pre-tax quote", () => {
  it("uses selected variant as base and adds group prices with checked integer arithmetic", () => {
    const q = quotePublishedSelection(makeMenu(), input(), now);
    expect(q.lines[0]).toMatchObject({ quantity: 2, unitMinor: "17500", lineSubtotalMinor: "35000" });
    expect(q).toMatchObject({ currency: "INR", exponent: 2, subtotalMinor: "35000", taxAndFeesCalculated: false });
  });
  it("supports zero-, two- and three-decimal currencies without dividing or floating point", () => {
    for (const [currency, exponent] of [["JPY", 0], ["INR", 2], ["OMR", 3]] as const)
      expect(quotePublishedSelection(makeMenu(currency), input(), now)).toMatchObject({ currency, exponent, subtotalMinor: "35000" });
  });
  it("rejects stale revision and unavailable/invalid selections", () => {
    expect(() => quotePublishedSelection(makeMenu(), { ...input(), expectedRevision: 3 }, now)).toThrow("changed");
    const unavailable = makeMenu();
    unavailable.menus[0]!.document.categories[0]!.items[0]!.soldOut = true;
    expect(() => quotePublishedSelection(unavailable, input(), now)).toThrow("unavailable");
    expect(() => quotePublishedSelection(makeMenu(), { ...input(), lines: [{ ...input().lines[0]!, groups: [] }] }, now)).toThrow("Select");
    expect(() => quotePublishedSelection(makeMenu(), { ...input(), lines: [{ ...input().lines[0]!, variantId: "bad" }] }, now)).toThrow("unavailable");
    expect(() => quotePublishedSelection(makeMenu(), { ...input(), lines: [{ ...input().lines[0]!, groups: [{ groupId: "bread", optionIds: ["naan", "naan"] }] }] }, now)).toThrow("Duplicate");
  });
  it("rejects a forged amount, unavailable modifier, extra group, demo or legacy document", () => {
    const item = input();
    expect(() => quotePublishedSelection(makeMenu(), { ...item, lines: [{ ...item.lines[0]!, priceMinor: 1 }] }, now)).toThrow();
    const blocked = makeMenu();
    blocked.menus[0]!.document.categories[0]!.items[0]!.addOnGroups[0]!.options[0]!.isAvailable = false;
    expect(() => quotePublishedSelection(blocked, input(), now)).toThrow("unavailable");
    expect(() => quotePublishedSelection(makeMenu(), { ...item, lines: [{ ...item.lines[0]!, groups: [{ groupId: "unknown", optionIds: [] }] }] }, now)).toThrow("Unknown");
    const demo = makeMenu();
    demo.outlet.isDemoData = true;
    expect(() => quotePublishedSelection(demo, input(), now)).toThrow("released real menu");
  });
  it("enforces bounded signed decimal integers rather than overflowing Number totals", () => {
    const huge = input();
    huge.lines[0]!.quantity = Number.MAX_SAFE_INTEGER;
    expect(() => quotePublishedSelection(makeMenu(), huge, now)).toThrow("exceeds");
  });
});
