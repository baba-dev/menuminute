import { describe, expect, it } from "vitest";
import { DEMO_IDS } from "../src/modules/demo/ids";
import { demoEntryDestination } from "../src/modules/demo/destinations";
import { STICKER_DEMO_URL } from "../src/components/marketing/storefront-studio/sticker-config";

describe("public demo acquisition", () => {
  it("uses the canonical guest-menu route for every storefront QR", () => {
    expect(STICKER_DEMO_URL).toBe(`https://food.bababuilds.com/m/${DEMO_IDS.publicId}`);
    expect(STICKER_DEMO_URL).not.toContain("kitchen-v1");
  });
  it("uses only fixed destinations and rejects open-redirect values", () => {
    expect(demoEntryDestination("orders")).toBe("/dashboard/orders");
    expect(demoEntryDestination("kitchen")).toBe("/kitchen");
    expect(demoEntryDestination("floor")).toBe("/dashboard/floor");
    expect(demoEntryDestination("menu")).toBe("/dashboard/menu");
    for (const value of [
      null,
      "",
      "https://attacker.invalid",
      "//attacker.invalid",
      "../admin",
      "__proto__",
    ]) {
      expect(demoEntryDestination(value)).toBe("/dashboard");
    }
  });
});
