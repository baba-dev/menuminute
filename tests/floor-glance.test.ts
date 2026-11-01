import { describe, expect, it } from "vitest";
import { recomputeOverview } from "../src/components/dashboard/floor/floor-state";
import type { FloorOverview } from "../src/modules/hospitality/floor-contracts";
import { buildFloorGlance, describeGlanceTable } from "../src/modules/hospitality/floor-glance";

const chair = (id: string, tableId: string, occupied = false) => ({
  id,
  tableId,
  label: null,
  kind: "standard" as const,
  occupied,
  occupiedAt: occupied ? "2026-11-01T10:00:00.000Z" : null,
  version: 0,
});
const table = (
  n: number,
  sectionId: string | null,
  taken: number,
  seats: number,
  extra: Partial<FloorOverview["tables"][number]> = {}
) => ({
  id: `t${n}`,
  displayNumber: n,
  name: `Table ${n}`,
  shape: "round" as const,
  sectionId,
  chairs: Array.from({ length: seats }, (_, i) => chair(`c${n}-${i}`, `t${n}`, i < taken)),
  maxOccupancy: 0,
  currentOccupancy: 0,
  state: "empty" as const,
  activeOrders: 0,
  unpaidOrders: 0,
  nextReservation: null,
  qrCode: null,
  stale: false,
  ...extra,
});
const overview = (tables: ReturnType<typeof table>[]): FloorOverview =>
  recomputeOverview({
    sections: [{ id: "s1", name: "Main", color: "#f59e0b", sortOrder: 0 }],
    tables,
    unassignedChairs: [],
    totals: {
      tables: 0,
      chairs: 0,
      maxOccupancy: 0,
      currentOccupancy: 0,
      sections: 1,
      tablesOccupied: 0,
    },
    nextReservation: null,
  });

describe("buildFloorGlance", () => {
  it("summarises seats, tables in use and order signals", () => {
    const g = buildFloorGlance(
      overview([
        table(1, "s1", 2, 4, { activeOrders: 1 }),
        table(2, "s1", 0, 2),
        table(3, null, 0, 4, { unpaidOrders: 2 }),
      ]),
      new Map([["t3", { dueMinor: "16700", latestOrderId: "o1" }]])
    );
    expect(g.totals).toEqual({ tables: 3, tablesInUse: 1, seats: 10, seatsTaken: 2 });
    expect(g.fillPct).toBe(20);
    expect(g.openOrders).toBe(1);
    expect(g.unpaidTabs).toBe(2);
    expect(g.groups.map((x) => x.name)).toEqual(["Main", "No section"]);
    expect(g.attention).toEqual([
      {
        kind: "unpaid",
        tableId: "t3",
        tableName: "Table 3",
        dueMinor: "16700",
        latestOrderId: "o1",
      },
    ]);
  });

  it("caps shown tables by attention and reports the overflow", () => {
    const tables = Array.from({ length: 6 }, (_, i) => table(i + 1, "s1", 0, 2));
    tables[5] = table(6, "s1", 0, 2, { unpaidOrders: 1 });
    const g = buildFloorGlance(overview(tables), null, 3);
    const shown = g.groups.flatMap((x) => x.tables.map((t) => t.table.id));
    expect(shown).toContain("t6");
    expect(shown).toHaveLength(3);
    expect(g.hiddenTables).toBe(3);
    // Floor order is kept inside the group even though t6 ranked first.
    expect(shown).toEqual(["t1", "t2", "t6"]);
  });

  it("maps table state to tone and flags stale seatings", () => {
    const g = buildFloorGlance(
      overview([table(1, "s1", 4, 4), table(2, "s1", 1, 4, { stale: true }), table(3, "s1", 0, 0)]),
      null
    );
    const tones = Object.fromEntries(
      g.groups.flatMap((x) => x.tables.map((t) => [t.table.id, t.tone]))
    );
    expect(tones).toEqual({ t1: "full", t2: "busy", t3: "free" });
    expect(g.attention.map((a) => [a.tableId, a.kind])).toEqual([["t2", "stale"]]);
  });

  it("handles an empty floor and tables with no chairs without dividing by zero", () => {
    expect(buildFloorGlance(overview([]), null).fillPct).toBe(0);
    const g = buildFloorGlance(overview([table(1, "s1", 0, 0)]), null);
    expect(g.fillPct).toBe(0);
    expect(describeGlanceTable(g.groups[0]!.tables[0]!, (m) => m)).toBe("Table 1: no chairs yet");
  });

  it("describes unpaid tables with the amount due", () => {
    const g = buildFloorGlance(
      overview([table(4, "s1", 0, 4, { unpaidOrders: 2 })]),
      new Map([["t4", { dueMinor: "16700", latestOrderId: null }]])
    );
    expect(describeGlanceTable(g.groups[0]!.tables[0]!, (m) => `₹${Number(m) / 100}`)).toBe(
      "Table 4: 0 of 4 seats taken, 2 unpaid, due ₹167"
    );
  });
});
