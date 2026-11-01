import { describe, expect, it } from "vitest";
import { floorHeadline } from "../src/modules/hospitality/floor-headline";

const totals = (over: Partial<ReturnType<typeof base>>) => ({ ...base(), ...over });
const base = () => ({
  tables: 0,
  chairs: 0,
  maxOccupancy: 0,
  currentOccupancy: 0,
  sections: 0,
  tablesOccupied: 0,
});
const fmt = (iso: string) => `T(${iso})`;

describe("floorHeadline", () => {
  it("guides an empty outlet", () => {
    expect(floorHeadline({ totals: totals({}), nextReservation: null }, fmt).headline).toMatch(
      /build your dining room/
    );
  });
  it("asks for chairs when tables exist without any", () => {
    expect(floorHeadline({ totals: totals({ tables: 1 }), nextReservation: null }, fmt)).toEqual({
      headline: "1 table is waiting for chairs.",
      detail: "Add chairs so we can count your seats.",
    });
    expect(
      floorHeadline({ totals: totals({ tables: 3 }), nextReservation: null }, fmt).headline
    ).toBe("3 tables are waiting for chairs.");
  });
  it("reports free, partial and full rooms with live numbers", () => {
    expect(
      floorHeadline({ totals: totals({ tables: 2, chairs: 1 }), nextReservation: null }, fmt)
        .headline
    ).toBe("1 seat, all free.");
    expect(
      floorHeadline(
        { totals: totals({ tables: 3, chairs: 12, currentOccupancy: 7 }), nextReservation: null },
        fmt
      ).headline
    ).toBe("7 of 12 seats taken, 5 free.");
    expect(
      floorHeadline(
        { totals: totals({ tables: 3, chairs: 12, currentOccupancy: 12 }), nextReservation: null },
        fmt
      ).headline
    ).toBe("Full house: 12 of 12 seats taken.");
  });
  it("prefers the next booking in the detail line", () => {
    const r = floorHeadline(
      {
        totals: totals({ tables: 2, chairs: 8, currentOccupancy: 2 }),
        nextReservation: { guestName: "Asha", partySize: 4, time: "2026-11-01T14:00:00Z" },
      },
      fmt
    );
    expect(r.detail).toBe("Next booking: Asha for 4 at T(2026-11-01T14:00:00Z).");
  });
});
