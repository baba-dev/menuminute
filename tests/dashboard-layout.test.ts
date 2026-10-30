import { describe, expect, it } from "vitest";
import {
  applyLayoutAction,
  dashboardLayoutInput,
  dashboardWidgetIds,
  defaultDashboardLayout,
  normalizeDashboardLayout,
  resolveDashboardLayout,
} from "../src/modules/dashboard/layout";

describe("dashboard layout contract", () => {
  it("rejects unknown ids, duplicates, extra keys and wrong versions on write", () => {
    const base = { version: 1, order: [...dashboardWidgetIds], hidden: [], pinned: [] };
    expect(dashboardLayoutInput.safeParse(base).success).toBe(true);
    expect(dashboardLayoutInput.safeParse({ ...base, order: ["kpis", "kpis"] }).success).toBe(
      false
    );
    expect(dashboardLayoutInput.safeParse({ ...base, hidden: ["nope"] }).success).toBe(false);
    expect(dashboardLayoutInput.safeParse({ ...base, extra: true }).success).toBe(false);
    expect(dashboardLayoutInput.safeParse({ ...base, version: 2 }).success).toBe(false);
  });

  it("normalizes stored hints: drops unknown ids, appends new widgets, defaults malformed JSON", () => {
    expect(normalizeDashboardLayout(null)).toEqual(defaultDashboardLayout);
    expect(normalizeDashboardLayout("junk")).toEqual(defaultDashboardLayout);
    const layout = normalizeDashboardLayout({
      order: ["health", "ghost", "health", "kpis"],
      hidden: ["floor", 7],
      pinned: "no",
    });
    expect(layout.order.slice(0, 2)).toEqual(["health", "kpis"]);
    expect([...layout.order].sort()).toEqual([...dashboardWidgetIds].sort());
    expect(layout.hidden).toEqual(["floor"]);
    expect(layout.pinned).toEqual([]);
  });

  it("shows pinned widgets first and keeps hidden ones restorable", () => {
    const layout = {
      ...defaultDashboardLayout,
      pinned: ["health" as const],
      hidden: ["floor" as const],
    };
    const resolved = resolveDashboardLayout(layout);
    expect(resolved[0]).toEqual({ id: "health", pinned: true, hidden: false });
    expect(resolved.find((w) => w.id === "floor")?.hidden).toBe(true);
    expect(resolved).toHaveLength(dashboardWidgetIds.length);
  });

  it("moves within its pinned/unpinned group and is a no-op at the edges", () => {
    const start = defaultDashboardLayout;
    const down = applyLayoutAction(start, { type: "move", id: "kpis", direction: 1 });
    expect(resolveDashboardLayout(down)[1]?.id).toBe("kpis");
    expect(applyLayoutAction(start, { type: "move", id: "kpis", direction: -1 })).toBe(start);
    const pinned = applyLayoutAction(start, { type: "togglePinned", id: "floor" });
    expect(resolveDashboardLayout(pinned)[0]?.id).toBe("floor");
    // A pinned widget cannot be moved past the pinned group.
    expect(applyLayoutAction(pinned, { type: "move", id: "floor", direction: 1 })).toBe(pinned);
    const hidden = applyLayoutAction(start, { type: "toggleHidden", id: "health" });
    expect(hidden.hidden).toEqual(["health"]);
    expect(applyLayoutAction(hidden, { type: "toggleHidden", id: "health" }).hidden).toEqual([]);
    expect(applyLayoutAction(down, { type: "reset" })).toEqual(defaultDashboardLayout);
  });
});
