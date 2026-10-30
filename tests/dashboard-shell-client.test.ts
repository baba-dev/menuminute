import { describe, expect, it } from "vitest";
import { parseShellSnapshot } from "../src/modules/dashboard/shell-client";

const good = {
  outletId: "o1",
  checkedAt: "2027-01-02T09:00:00.000Z",
  pulse: {
    state: "ready",
    data: { pending: 1, preparing: 2, ready: 3, active: 6, completedToday: 9 },
  },
  requests: {
    state: "ready",
    data: { open: 2, unacknowledged: 1, oldestAt: "2027-01-02T08:00:00.000Z" },
  },
  till: {
    state: "ready",
    data: {
      open: true,
      registers: 1,
      currency: "OMR",
      expectedMinor: "31000",
      openedAt: "2027-01-02T05:00:00.000Z",
    },
  },
};

describe("shell response validation", () => {
  it("accepts a well-formed response and keeps only known fields", () => {
    const parsed = parseShellSnapshot({ ...good, extra: "ignored" }, "o1");
    expect(parsed).toMatchObject({ outletId: "o1", pulse: { state: "ready" } });
    expect(JSON.stringify(parsed)).not.toContain("ignored");
  });

  it("accepts restricted and unavailable sections without data", () => {
    const parsed = parseShellSnapshot(
      {
        ...good,
        pulse: { state: "restricted", data: null },
        till: { state: "unavailable", data: null },
      },
      "o1"
    );
    expect(parsed?.pulse).toEqual({ state: "restricted", data: null });
    expect(parsed?.till).toEqual({ state: "unavailable", data: null });
  });

  it("rejects a response for another outlet, so an outlet switch cannot mix data", () => {
    expect(parseShellSnapshot(good, "someone-else")).toBeNull();
  });

  it.each([
    ["not an object", "oops"],
    ["null", null],
    ["missing checkedAt", { ...good, checkedAt: undefined }],
    ["unknown state", { ...good, pulse: { state: "weird", data: null } }],
    ["ready without data", { ...good, requests: { state: "ready", data: null } }],
    [
      "string counter",
      { ...good, pulse: { state: "ready", data: { ...good.pulse.data, pending: "1" } } },
    ],
    [
      "NaN counter",
      { ...good, pulse: { state: "ready", data: { ...good.pulse.data, ready: Number.NaN } } },
    ],
    ["bad till", { ...good, till: { state: "ready", data: { open: "yes" } } }],
    ["missing section", { ...good, till: undefined }],
  ])("rejects %s as a failed refresh", (_name, body) => {
    expect(parseShellSnapshot(body, "o1")).toBeNull();
  });
});
