import { describe, expect, it } from "vitest";
import { prepareRepeatCart } from "../src/lib/pos/repeat-selection";
import { posRepeatSelectionSchema, type PosWorkspace } from "../src/modules/pos/service";

const original = () =>
  posRepeatSelectionSchema.parse({
    orderId: "order-42",
    items: [
      {
        dishId: "noodles",
        variantId: "large",
        quantity: 2,
        selectedOptions: [{ groupId: "extras", optionId: "chutney" }],
      },
    ],
  });

const menu = () =>
  [
    {
      id: "current-menu",
      open: true,
      categories: [
        {
          items: [
            {
              id: "noodles",
              name: "Noodles",
              open: true,
              soldOut: false,
              priceMinor: 2000,
              variants: [{ id: "large", name: "Large", priceMinor: 2500, isAvailable: true }],
              addOnGroups: [
                {
                  id: "extras",
                  name: "Extras",
                  min: 0,
                  max: 2,
                  options: [{ id: "chutney", priceMinor: 150, isAvailable: true }],
                },
              ],
            },
          ],
        },
      ],
    },
  ] as unknown as PosWorkspace["menus"];

describe("POS repeat selection", () => {
  it("prefills only a NEW draft from current catalog prices, not historical totals", () => {
    const result = prepareRepeatCart(original(), menu(), "current-menu");
    expect(result.menuId).toBe("current-menu");
    expect(result.items[0]?.unitMinor).toBe(2650);
    expect(result.items[0]?.line).toEqual({
      dishId: "noodles",
      variantId: "large",
      quantity: 2,
      groups: [{ groupId: "extras", optionIds: ["chutney"] }],
    });
  });

  it("does not silently substitute sold-out dishes, stale variants or removed add-ons", () => {
    const soldOut = menu();
    soldOut[0]!.categories[0]!.items[0]!.soldOut = true;
    expect(() => prepareRepeatCart(original(), soldOut, "current-menu")).toThrow();

    const unavailableVariant = menu();
    unavailableVariant[0]!.categories[0]!.items[0]!.variants[0]!.isAvailable = false;
    expect(() => prepareRepeatCart(original(), unavailableVariant, "current-menu")).toThrow();

    const removedOption = menu();
    removedOption[0]!.categories[0]!.items[0]!.addOnGroups[0]!.options = [];
    expect(() => prepareRepeatCart(original(), removedOption, "current-menu")).toThrow();
  });

  it("rejects incomplete and unavailable repeats, not a partial cart", () => {
    const twoDishes = original();
    twoDishes.items.push({
      dishId: "not-on-menu",
      variantId: null,
      selectedOptions: [],
      quantity: 1,
    });
    expect(() => prepareRepeatCart(twoDishes, menu(), "current-menu")).toThrow();
    const closed = menu();
    closed[0]!.open = false;
    expect(() => prepareRepeatCart(original(), closed, "current-menu")).toThrow();
  });

  it("never accepts malformed item IDs or excessive quantities in a server read model", () => {
    expect(() =>
      posRepeatSelectionSchema.parse({
        ...original(),
        items: [{ ...original().items[0], quantity: 100 }],
      })
    ).toThrow();
    expect(() =>
      posRepeatSelectionSchema.parse({ ...original(), orderId: "../../another-outlet" })
    ).toThrow();
    expect(() => posRepeatSelectionSchema.parse({ ...original(), items: [] })).toThrow();
  });
});
