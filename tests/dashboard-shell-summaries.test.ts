import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "../src/lib/errors";
import { section, summarizeRequests, summarizeShifts } from "../src/modules/dashboard/shell-data";
import type { ShiftRow } from "../src/modules/pos/finance";
import type { GuestServiceRequest } from "../src/modules/hospitality/service";

const shift = (over: Partial<ShiftRow> = {}): ShiftRow => ({
  id: "s1",
  registerName: "Front",
  state: "open",
  actorId: "u1",
  openingMinor: "10000",
  expectedMinor: null,
  countedMinor: null,
  currency: "OMR",
  openedAt: "2027-01-02T06:00:00.000Z",
  closedAt: null,
  cashTakenMinor: "25000",
  cashRefundMinor: "4000",
  ...over,
});

describe("till summary", () => {
  it("reports closed with no expected figure when no register is open", () => {
    expect(summarizeShifts([shift({ state: "closed" })], "INR")).toEqual({
      open: false,
      registers: 0,
      currency: "INR",
      expectedMinor: null,
      openedAt: null,
    });
    expect(summarizeShifts([], "INR").open).toBe(false);
  });

  it("derives expected cash from the float, cash taken and refunds when the database gives none", () => {
    const summary = summarizeShifts([shift()], "INR");
    expect(summary).toMatchObject({ open: true, registers: 1, currency: "OMR" });
    expect(summary.expectedMinor).toBe("31000");
  });

  it("prefers the database's own expected figure and sums only open registers", () => {
    const summary = summarizeShifts(
      [
        shift({ expectedMinor: "50000" }),
        shift({
          id: "s2",
          registerName: "Bar",
          expectedMinor: "7000",
          openedAt: "2027-01-02T05:00:00.000Z",
        }),
        shift({ id: "s3", state: "closed", expectedMinor: "999999" }),
      ],
      "OMR"
    );
    expect(summary.registers).toBe(2);
    expect(summary.expectedMinor).toBe("57000");
    expect(summary.openedAt).toBe("2027-01-02T05:00:00.000Z");
  });

  it("never invents a total from malformed amounts", () => {
    expect(summarizeShifts([shift({ cashTakenMinor: "abc" })], "OMR").expectedMinor).toBeNull();
    expect(
      summarizeShifts([shift({ openingMinor: "1".repeat(40) })], "OMR").expectedMinor
    ).toBeNull();
  });
});

describe("guest request summary", () => {
  const request = (over: Partial<GuestServiceRequest>): GuestServiceRequest => ({
    id: "r",
    orderNumber: 1,
    tableNumber: "4",
    signal: "call_server",
    status: "requested",
    requestedAt: "2027-01-02T09:00:00.000Z",
    acknowledgedAt: null,
    ...over,
  });

  it("counts open and unacknowledged separately and finds the oldest open request", () => {
    const summary = summarizeRequests([
      request({ id: "a", requestedAt: "2027-01-02T09:05:00.000Z" }),
      request({ id: "b", status: "acknowledged", requestedAt: "2027-01-02T08:50:00.000Z" }),
      request({ id: "c", status: "resolved", requestedAt: "2027-01-02T07:00:00.000Z" }),
    ]);
    expect(summary).toEqual({ open: 2, unacknowledged: 1, oldestAt: "2027-01-02T08:50:00.000Z" });
  });

  it("is empty, not undefined, with no requests", () => {
    expect(summarizeRequests([])).toEqual({ open: 0, unacknowledged: 0, oldestAt: null });
  });
});

describe("isolated sources", () => {
  it("maps a forbidden read to restricted and anything else to unavailable, never to zero", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(await section("x", async () => 5)).toEqual({ state: "ready", data: 5 });
    expect(
      await section("x", async () => {
        throw new ForbiddenError();
      })
    ).toEqual({ state: "restricted", data: null });
    // A raw Postgres insufficient_privilege error is also "restricted", not an outage.
    expect(
      await section("x", async () => {
        throw Object.assign(new Error("permission denied"), { code: "42501" });
      })
    ).toEqual({ state: "restricted", data: null });
    expect(
      await section("x", async () => {
        throw new Error("select * from secrets where token='abc'");
      })
    ).toEqual({ state: "unavailable", data: null });
    // The raw error text (which can hold SQL or parameters) is never logged.
    expect(JSON.stringify(spy.mock.calls)).not.toContain("secrets");
    spy.mockRestore();
  });
});
