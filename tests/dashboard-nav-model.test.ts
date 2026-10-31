import { describe, expect, it } from "vitest";
import {
  addOnHint,
  bottomBarItems,
  groupNavigation,
  isNavSelected,
  moreItems,
  navItems,
  navState,
} from "../src/modules/dashboard/nav-model";
import type { DashboardNavigation } from "../src/modules/menu-product/dashboard-data";

const caps = (over: Partial<DashboardNavigation> = {}): DashboardNavigation => ({
  ordering: true,
  kitchen: true,
  ordersRead: true,
  kitchenRead: true,
  kitchenSetup: false,
  kitchenOperational: true,
  kitchenDraining: false,
  ...over,
});
const find = (id: string) => navItems.find((item) => item.id === id)!;
const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("navigation availability keeps the original gating rules", () => {
  it("ungated destinations are always available, even when capabilities are unknown", () => {
    for (const id of ["overview", "pos", "menu", "qr", "organization", "settings"])
      expect(navState(find(id), undefined).state).toBe("available");
  });

  it("ordering-gated items need the entitlement and orders.read", () => {
    for (const id of ["orders", "floor", "reports"]) {
      expect(navState(find(id), caps()).state).toBe("available");
      expect(navState(find(id), caps({ ordering: false }))).toMatchObject({
        state: "unavailable",
        reason: "not-enabled",
      });
      expect(navState(find(id), caps({ ordersRead: false }))).toMatchObject({
        state: "unavailable",
        reason: "access-required",
      });
      expect(navState(find(id), undefined)).toMatchObject({ reason: "unknown" });
    }
  });

  it("the kitchen is usable when operational or in setup, and says Kitchen Setup until live", () => {
    expect(navState(find("kitchen"), caps())).toEqual({ state: "available", label: "Kitchen" });
    expect(
      navState(find("kitchen"), caps({ kitchenOperational: false, kitchenSetup: true }))
    ).toEqual({ state: "available", label: "Kitchen Setup" });
    expect(
      navState(find("kitchen"), caps({ kitchenOperational: false, kitchenSetup: false }))
    ).toMatchObject({ state: "unavailable", reason: "not-enabled" });
    expect(navState(find("kitchen"), undefined)).toMatchObject({ reason: "unknown" });
  });
});

describe("grouped sidebar", () => {
  it("groups destinations as Run service, Menu, Insights and Admin", () => {
    const grouped = groupNavigation(caps());
    expect(grouped.overview.id).toBe("overview");
    expect(grouped.groups.map((g) => [g.label, ids(g.items)])).toEqual([
      ["Run service", ["orders", "pos", "kitchen", "floor"]],
      ["Menu", ["menu", "qr"]],
      ["Insights", ["reports"]],
      ["Admin", ["organization", "settings"]],
    ]);
    expect(grouped.addOns).toEqual([]);
  });

  it("collapses known-unavailable items into Add-ons and drops empty groups", () => {
    const grouped = groupNavigation(caps({ ordering: false, kitchenOperational: false }));
    expect(ids(grouped.addOns)).toEqual(["orders", "kitchen", "floor", "reports"]);
    expect(grouped.groups.map((g) => [g.id, ids(g.items)])).toEqual([
      ["run", ["pos"]],
      ["menu", ["menu", "qr"]],
      ["admin", ["organization", "settings"]],
    ]);
  });

  it("never claims an upgrade is needed when capabilities could not be read", () => {
    const grouped = groupNavigation(undefined);
    expect(grouped.addOns).toEqual([]);
    const orders = grouped.groups.flatMap((g) => g.items).find((i) => i.id === "orders")!;
    expect(orders.nav).toMatchObject({ state: "unavailable", reason: "unknown" });
  });

  it("distinguishes an upgrade from a missing role in the hint", () => {
    const notEnabled = groupNavigation(caps({ ordering: false })).addOns.find(
      (i) => i.id === "orders"
    )!;
    const noRole = groupNavigation(caps({ ordersRead: false })).addOns.find(
      (i) => i.id === "orders"
    )!;
    expect(addOnHint(notEnabled)).toMatch(/Upgrade/);
    expect(addOnHint(noRole)).toMatch(/administrator/);
    expect(addOnHint(noRole)).not.toMatch(/Upgrade/);
  });

  it("marks the right item as selected, and Overview only on an exact match", () => {
    expect(isNavSelected(find("overview"), "/dashboard")).toBe(true);
    expect(isNavSelected(find("overview"), "/dashboard/orders")).toBe(false);
    expect(isNavSelected(find("pos"), "/dashboard/pos/closing")).toBe(true);
    expect(isNavSelected(find("pos"), "/dashboard/pos-other")).toBe(false);
  });
});

describe("mobile bottom bar", () => {
  it("shows Orders, Till, Kitchen and Floor when all are usable", () => {
    expect(ids(bottomBarItems(caps()))).toEqual(["orders", "pos", "kitchen", "floor"]);
  });

  it("filters by permission rather than showing dead tabs", () => {
    expect(ids(bottomBarItems(caps({ kitchenOperational: false })))).toEqual([
      "orders",
      "pos",
      "floor",
    ]);
  });

  it("back-fills a menu-only outlet so the bar is never nearly empty", () => {
    const bar = ids(bottomBarItems(caps({ ordering: false, kitchenOperational: false })));
    expect(bar).toEqual(["overview", "pos", "menu", "qr"]);
  });

  it("falls back to ungated destinations when capabilities are unknown", () => {
    expect(ids(bottomBarItems(undefined))).toEqual(["overview", "pos", "menu", "qr"]);
  });

  it("lists everything else that is available in More, with no duplicates of the bar", () => {
    const more = ids(moreItems(caps()));
    expect(more).toEqual(["overview", "menu", "qr", "reports", "organization", "settings"]);
    const bar = ids(bottomBarItems(caps()));
    expect(more.filter((id) => bar.includes(id))).toEqual([]);
  });
});
