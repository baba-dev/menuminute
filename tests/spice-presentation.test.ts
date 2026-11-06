import { describe, expect, it } from "vitest";
import { getSpicePresentation, MAX_SPICE_LEVEL } from "../src/modules/menu-product/spice-presentation";

describe("merchant-provided dish heat presentation", () => {
  it("keeps existing 1–4 meanings and exposes the new fifth chilli", () => {
    expect(MAX_SPICE_LEVEL).toBe(5);
    expect(getSpicePresentation(1)).toEqual({ level: 1, label: "Mild" });
    expect(getSpicePresentation(4)).toEqual({ level: 4, label: "Extra fiery" });
    expect(getSpicePresentation(5)).toEqual({ level: 5, label: "Scorching" });
  });

  it("does not turn missing/default/invalid spice values into invented claims", () => {
    for (const level of [undefined, 0, -1, 2.5, 6, NaN])
      expect(getSpicePresentation(level)).toBeNull();
  });
});
