import { describe, expect, it } from "vitest";
import {
  groupBySection,
  recomputeOverview,
  withChair,
} from "../src/components/dashboard/floor/floor-state";
import type { FloorOverview } from "../src/modules/hospitality/floor-contracts";

const chair = (id: string, occupied = false) => ({
  id,
  tableId: "t1",
  label: null,
  kind: "standard" as const,
  occupied,
  occupiedAt: occupied ? "2026-11-01T10:00:00.000Z" : null,
  version: 0,
});
const table = (id: string, sectionId: string | null, chairs: ReturnType<typeof chair>[]) => ({
  id,
  displayNumber: 1,
  name: id,
  shape: "round" as const,
  sectionId,
  chairs,
  maxOccupancy: 0,
  currentOccupancy: 0,
  state: "empty" as const,
  activeOrders: 0,
  unpaidOrders: 0,
  nextReservation: null,
  qrCode: null,
  stale: false,
});
const base = (): FloorOverview =>
  recomputeOverview({
    sections: [
      { id: "s1", name: "Main", color: "#f59e0b", sortOrder: 0 },
      { id: "s2", name: "Patio", color: "#10b981", sortOrder: 1 },
    ],
    tables: [
      table("t1", "s1", [chair("a"), chair("b", true), chair("c")]),
      table("t2", null, [chair("d")]),
      table("t3", "s2", []),
    ],
    unassignedChairs: [],
    totals: {
      tables: 0,
      chairs: 0,
      maxOccupancy: 0,
      currentOccupancy: 0,
      sections: 0,
      tablesOccupied: 0,
    },
    nextReservation: null,
  });

describe("floor state", () => {
  it("derives occupancy, state and totals from chairs", () => {
    const o = base();
    expect(o.totals).toMatchObject({
      tables: 3,
      chairs: 4,
      currentOccupancy: 1,
      sections: 2,
      tablesOccupied: 1,
    });
    expect(o.tables.map((t) => t.state)).toEqual(["partial", "empty", "no_chairs"]);
  });
  it("optimistically toggles one chair and keeps totals honest", () => {
    const o = withChair(base(), "a", { occupied: true });
    expect(o.tables[0]).toMatchObject({ currentOccupancy: 2, state: "partial" });
    const full = withChair(withChair(o, "c", { occupied: true }), "b", { occupied: true });
    expect(full.tables[0]!.state).toBe("full");
    expect(full.totals.currentOccupancy).toBe(3);
    const freed = withChair(full, "a", { occupied: false, version: 5 });
    expect(freed.tables[0]!.chairs[0]).toMatchObject({
      occupied: false,
      occupiedAt: null,
      version: 5,
    });
  });
  it("groups tables by section and collects the rest under No section", () => {
    const o = base();
    const groups = groupBySection(o, o.tables);
    expect(groups.map((g) => [g.name, g.tables.length, g.seats, g.taken])).toEqual([
      ["Main", 1, 3, 1],
      ["Patio", 1, 0, 0],
      ["No section", 1, 1, 0],
    ]);
  });
});
