import { describe, expect, it } from "vitest";
import { workspaceBreadcrumb } from "../src/app/(dashboard)/workspace-breadcrumb";
import { resolvePosDisplayTotals } from "../src/modules/pos/display-totals";
import { buildDemoBaseline } from "../src/modules/demo/baseline";

describe("workspace navigation polish", () => {
  it("keeps stable primary labels and expands nested financial routes", () => {
    expect(workspaceBreadcrumb("/dashboard")).toEqual([{ label: "Restaurant overview" }]);
    expect(workspaceBreadcrumb("/dashboard/pos/closing")).toEqual([
      { label: "Point of Sale", href: "/dashboard/pos" },
      { label: "Closing Desk" },
    ]);
    expect(workspaceBreadcrumb("/dashboard/pos/ledger/documents/abc")).toEqual([
      { label: "Point of Sale", href: "/dashboard/pos" },
      { label: "The Ledger", href: "/dashboard/pos/ledger" },
      { label: "Document" },
    ]);
    expect(workspaceBreadcrumb("/dashboard/menu/import/abc/review")).toEqual([
      { label: "Menu Studio", href: "/dashboard/menu" },
      { label: "Import menu", href: "/dashboard/menu/import" },
      { label: "Review import" },
    ]);
    expect(workspaceBreadcrumb("/account/security")).toEqual([
      { label: "My account", href: "/account" },
      { label: "Security" },
    ]);
  });

  it("never misreports an inactive POS as having zero published menus", () => {
    const menus = [
      { categories: [{ items: [{ id: "one" }, { id: "two" }] }] },
      { categories: [{ items: [{ id: "one" }, { id: "three" }] }] },
    ];
    expect(resolvePosDisplayTotals(false, [], null)).toEqual({ menus: null, dishes: null });
    expect(resolvePosDisplayTotals(false, [], { menus: 1, dishes: 236 })).toEqual({
      menus: 1,
      dishes: 236,
    });
    expect(resolvePosDisplayTotals(true, menus)).toEqual({ menus: 2, dishes: 3 });
  });

  it("seeds recent kitchen tickets and a complete sample floor, not stale live orders", () => {
    const baseline = buildDemoBaseline(new Date("2026-11-08T12:00:00.000Z"));
    const live = baseline.orders.filter((order) => order.live);
    expect(baseline.tables).toHaveLength(12);
    expect(live).toHaveLength(9);
    expect(Math.max(...live.map((order) => order.minutesAgo))).toBeLessThanOrEqual(42);
    expect(Math.min(...live.map((order) => order.minutesAgo))).toBeGreaterThanOrEqual(0);
  });
});
