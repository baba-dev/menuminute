import { describe, it, expect } from "vitest";
import {
  advanceStationWork,
  assignStationWork,
  canExpeditorRelease,
  releaseFromExpeditor,
  stationSummary,
} from "../src/modules/kitchen/workflow";
function base() {
  return assignStationWork({
    organizationId: "org1",
    outletId: "outlet1",
    orderId: "order1",
    lines: [
      { id: "paneer", dishName: "Paneer", quantity: 2 },
      { id: "naan", dishName: "Naan", quantity: 1 },
    ],
    routes: [
      { lineId: "paneer", stationIds: ["grill", "expo-prep"], ruleVersion: 1 },
      { lineId: "naan", stationIds: ["tandoor"], ruleVersion: 1 },
    ],
  });
}
describe("multi-station kitchen reducer (contract producer)", () => {
  it("creates stable distinct work for every routed line and station without premature release", () => {
    const s = base();
    expect(s.work).toHaveLength(3);
    expect(new Set(s.work.map((w) => w.id)).size).toBe(3);
    expect(canExpeditorRelease(s)).toBe(false);
    expect(stationSummary(s, "grill").outstandingQuantity).toBe("2");
    expect(() => releaseFromExpeditor(s, 0)).toThrow("Every required station");
  });
  it("uses expected versions and requires all station work + explicit expeditor release", () => {
    let s = base();
    for (const item of s.work) {
      s = advanceStationWork(s, { workId: item.id, expectedVersion: 0, action: "start" });
      expect(() =>
        advanceStationWork(s, { workId: item.id, expectedVersion: 0, action: "start" })
      ).toThrow("changed");
      s = advanceStationWork(s, { workId: item.id, expectedVersion: 1, action: "complete" });
      if (item !== base().work[base().work.length - 1]) expect(s.released).toBe(false);
    }
    expect(canExpeditorRelease(s)).toBe(true);
    expect(() => releaseFromExpeditor(s, 0)).toThrow("changed");
    const released = releaseFromExpeditor(s, s.version);
    expect(released.released).toBe(true);
    expect(() =>
      advanceStationWork(released, {
        workId: released.work[0]!.id,
        expectedVersion: 2,
        action: "start",
      })
    ).toThrow("already");
  });
  it("rejects duplicate/unknown routing and cancelled work cannot silently count as done", () => {
    expect(() =>
      assignStationWork({
        organizationId: "a",
        outletId: "b",
        orderId: "c",
        lines: [{ id: "l", dishName: "Dish", quantity: 1 }],
        routes: [{ lineId: "l", stationIds: ["a", "a"], ruleVersion: 1 }],
      })
    ).toThrow("twice");
    const s = base();
    const cancelled = advanceStationWork(s, {
      workId: s.work[0]!.id,
      expectedVersion: 0,
      action: "cancel",
    });
    expect(canExpeditorRelease(cancelled)).toBe(false);
    expect(() => releaseFromExpeditor(cancelled, cancelled.version)).toThrow("Every required");
  });
});
