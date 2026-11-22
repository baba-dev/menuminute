import { describe, expect, it } from "vitest";
import {
  addableCombos,
  addDays,
  buildGrid,
  buildSlotPayload,
  cellKey,
  checkOverrideDate,
  DEFAULT_SLOTS,
  minutesToTime,
  moveItem,
  orderedWeekdays,
  overrideWindow,
  timeToMinutes,
  validateWindow,
  weekdayName,
  zonedToday,
} from "../src/app/(dashboard)/dashboard/tiffin/week/week-form";

describe("week grid model", () => {
  const combos = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "z", name: "Z", archived: true },
  ];
  it("builds 7x2 cells, fills missing days empty, drops archived and duplicate ids", () => {
    const grid = buildGrid(
      [
        { slotKind: "lunch", weekday: 1, comboIds: ["b", "z", "a", "b"] },
        { slotKind: "dinner", weekday: 0, comboIds: ["a"] },
      ],
      combos
    );
    expect(Object.keys(grid)).toHaveLength(14);
    expect(grid[cellKey("lunch", 1)]).toEqual(["b", "a"]);
    expect(grid[cellKey("dinner", 0)]).toEqual(["a"]);
    expect(grid[cellKey("lunch", 2)]).toEqual([]);
  });
  it("addable combos exclude archived and already-added", () => {
    expect(addableCombos(combos, ["a"]).map((c) => c.id)).toEqual(["b"]);
  });
});

describe("moveItem", () => {
  it("moves and respects boundaries without mutating", () => {
    const src = ["a", "b", "c"];
    expect(moveItem(src, 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveItem(src, 1, 1)).toEqual(["a", "c", "b"]);
    expect(moveItem(src, 0, -1)).toEqual(["a", "b", "c"]);
    expect(moveItem(src, 2, 1)).toEqual(["a", "b", "c"]);
    expect(src).toEqual(["a", "b", "c"]);
  });
});

describe("weekdays", () => {
  it("maps 0 to Sunday and 1 to Monday", () => {
    expect(weekdayName(0, "en-US")).toBe("Sunday");
    expect(weekdayName(1, "en-US")).toBe("Monday");
    expect(weekdayName(6, "en-US")).toBe("Saturday");
  });
  it("orders seven distinct weekdays", () => {
    const order = orderedWeekdays("en-US");
    expect([...order].sort()).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(order[0]).toBe(0);
    expect(orderedWeekdays("en-GB")[0]).toBe(1);
  });
});

describe("outlet-local dates", () => {
  it("uses the outlet timezone, not UTC", () => {
    expect(zonedToday(new Date("2026-03-29T23:30:00Z"), "Europe/London")).toBe("2026-03-30");
    expect(zonedToday(new Date("2026-03-29T23:30:00Z"), "UTC")).toBe("2026-03-29");
    expect(zonedToday(new Date("2026-11-01T04:30:00Z"), "America/New_York")).toBe("2026-11-01");
    expect(zonedToday(new Date("2026-11-01T03:30:00Z"), "America/New_York")).toBe("2026-10-31");
  });
  it("computes the window and validates dates", () => {
    expect(overrideWindow("2026-03-30")).toEqual({ min: "2026-03-30", max: "2027-03-31" });
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(checkOverrideDate("2026-03-30", "2026-03-30")).toBeNull();
    expect(checkOverrideDate("2027-03-31", "2026-03-30")).toBeNull();
    expect(checkOverrideDate("2026-03-29", "2026-03-30")).toMatch(/Past dates/);
    expect(checkOverrideDate("2027-04-01", "2026-03-30")).toMatch(/within 366 days/);
    expect(checkOverrideDate("", "2026-03-30")).toMatch(/Choose a date/);
    expect(checkOverrideDate("2026-02-30", "2026-01-01")).toMatch(/valid/);
  });
});

describe("slot window", () => {
  it("converts minutes and HH:MM", () => {
    expect(minutesToTime(690)).toBe("11:30");
    expect(minutesToTime(1440)).toBe("24:00");
    expect(timeToMinutes("11:30")).toBe(690);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(timeToMinutes("24:01")).toBeNull();
    expect(timeToMinutes("9:00")).toBeNull();
  });
  it("requires end after start on the same day", () => {
    expect(validateWindow("11:00", "14:00")).toEqual({
      ok: true,
      startMinute: 660,
      endMinute: 840,
    });
    expect(validateWindow("14:00", "14:00").ok).toBe(false);
    expect(validateWindow("15:00", "14:00").ok).toBe(false);
    expect(validateWindow("", "14:00").ok).toBe(false);
    expect(validateWindow("24:00", "24:00").ok).toBe(false);
  });
  it("keeps cutoff and capacity unchanged in the save body", () => {
    const stored = { ...DEFAULT_SLOTS.lunch, cutoffMinutesBefore: 90, capacity: 40 };
    expect(buildSlotPayload(stored, { startMinute: 600, endMinute: 700 }, false)).toEqual({
      kind: "lunch",
      startMinute: 600,
      endMinute: 700,
      cutoffMinutesBefore: 90,
      capacity: 40,
      enabled: false,
    });
  });
});
