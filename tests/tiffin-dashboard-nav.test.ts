import { afterEach, describe, expect, it, vi } from "vitest";
import {
  bottomBarItems,
  groupNavigation,
  moreItems,
  resolveNavigation,
} from "../src/modules/dashboard/nav-model";
import { buildStaticEntries } from "../src/modules/dashboard/palette-model";
import { tiffinNavEnabled } from "../src/modules/tiffin/dashboard-access";
import type { DashboardNavigation } from "../src/modules/menu-product/dashboard-data";

const caps = (over: Partial<DashboardNavigation> = {}): DashboardNavigation => ({
  ordering: true,
  crm: true,
  kitchen: true,
  ordersRead: true,
  kitchenRead: true,
  kitchenSetup: false,
  kitchenOperational: true,
  kitchenDraining: false,
  ...over,
});
const ids = (items: { id: string }[]) => items.map((item) => item.id);
const paletteIds = (capabilities: DashboardNavigation | undefined) =>
  buildStaticEntries({ capabilities, menuWrite: true, assistantEnabled: false })
    .filter((entry) => entry.id.startsWith("page:"))
    .map((entry) => entry.id);

describe("Tiffin navigation entry", () => {
  it("appears only when the server marked the tiffin entry available", () => {
    const on = caps({ tiffin: true });
    expect(ids(resolveNavigation(on))).toContain("tiffin");
    const entry = resolveNavigation(on).find((item) => item.id === "tiffin")!;
    expect(entry).toMatchObject({
      href: "/dashboard/tiffin",
      label: "Tiffin menu",
      nav: { state: "available" },
    });
    for (const off of [caps(), caps({ tiffin: false }), undefined]) {
      expect(ids(resolveNavigation(off))).not.toContain("tiffin");
      expect(ids(groupNavigation(off).groups.flatMap((g) => g.items))).not.toContain("tiffin");
      expect(ids(groupNavigation(off).addOns)).not.toContain("tiffin");
      expect(ids(moreItems(off))).not.toContain("tiffin");
      expect(paletteIds(off)).not.toContain("page:tiffin");
    }
  });

  it("is listed under Menu, reachable from More and the palette, never in the bottom bar", () => {
    const on = caps({ tiffin: true });
    const menu = groupNavigation(on).groups.find((g) => g.id === "menu")!;
    expect(ids(menu.items)).toEqual(["menu", "qr", "tiffin"]);
    expect(ids(moreItems(on))).toContain("tiffin");
    expect(ids(bottomBarItems(on))).not.toContain("tiffin");
    expect(paletteIds(on)).toContain("page:tiffin");
  });

  it("leaves every other destination exactly as before", () => {
    const base = ids(resolveNavigation(caps()));
    expect(base).toEqual([
      "overview",
      "orders",
      "pos",
      "kitchen",
      "floor",
      "menu",
      "qr",
      "guests",
      "reports",
      "organization",
      "settings",
    ]);
    expect(ids(resolveNavigation(caps({ tiffin: true }))).filter((id) => id !== "tiffin")).toEqual(
      base
    );
    expect(ids(bottomBarItems(caps({ tiffin: true })))).toEqual(ids(bottomBarItems(caps())));
  });
});

describe("tiffinNavEnabled (server-side decision)", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("is true only for a tiffin outlet with the flag on", () => {
    vi.stubEnv("TIFFIN_ENABLED", "true");
    expect(tiffinNavEnabled("tiffin")).toBe(true);
    for (const type of ["restaurant", "cafe", "bakery", "", undefined, null])
      expect(tiffinNavEnabled(type)).toBe(false);
  });

  it("is false for a tiffin outlet when the flag is off, unset or malformed", () => {
    vi.stubEnv("TIFFIN_ENABLED", "false");
    expect(tiffinNavEnabled("tiffin")).toBe(false);
    vi.stubEnv("TIFFIN_ENABLED", "yes please");
    expect(tiffinNavEnabled("tiffin")).toBe(false);
    vi.stubEnv("TIFFIN_ENABLED", "");
    expect(tiffinNavEnabled("tiffin")).toBe(false);
    vi.unstubAllEnvs();
    delete process.env["TIFFIN_ENABLED"];
    expect(tiffinNavEnabled("tiffin")).toBe(false);
  });
});
