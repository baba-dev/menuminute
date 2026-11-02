import { describe, expect, it } from "vitest";
import { buildJourney, DEFAULT_SIGNAL_SETTINGS } from "../src/modules/hospitality/floor-signals";

const on = { ...DEFAULT_SIGNAL_SETTINGS, enabled: true };
const T = "2026-11-02T12:00:00.000Z";
const order = (status: string, paymentStatus = "unpaid") => ({
  status,
  paymentStatus,
  createdAt: T,
  updatedAt: T,
  dishCount: 2,
});
const state = (j: ReturnType<typeof buildJourney>, key: string) =>
  j?.steps.find((s) => s.key === key)?.state;

describe("buildJourney", () => {
  it("is null when the outlet has not enabled signals", () => {
    expect(buildJourney({ settings: DEFAULT_SIGNAL_SETTINGS, events: [], order: null })).toBeNull();
  });

  it("starts idle with no events or orders", () => {
    const j = buildJourney({ settings: on, events: [], order: null })!;
    expect(j.steps.every((s) => s.state === "idle")).toBe(true);
    expect(j.needsStaff).toBe(false);
  });

  it("follows the order lifecycle", () => {
    const j = (s: string) => buildJourney({ settings: on, events: [], order: order(s) });
    expect(state(j("pending"), "order")).toBe("done");
    expect(j("pending")!.steps.find((s) => s.key === "order")!.detail).toBe("2 dishes");
    expect(state(j("preparing"), "cooking")).toBe("active");
    expect(state(j("ready"), "ready")).toBe("active");
    expect(state(j("ready"), "cooking")).toBe("done");
    expect(state(j("served"), "delivered")).toBe("done");
    expect(state(j("served"), "ready")).toBe("done");
  });

  it("ignores rejected, cancelled and expired orders", () => {
    for (const s of ["rejected", "cancelled", "expired"])
      expect(state(buildJourney({ settings: on, events: [], order: order(s) }), "order")).toBe(
        "idle"
      );
  });

  it("marks paid from the order payment status", () => {
    const j = buildJourney({ settings: on, events: [], order: order("served", "paid") });
    expect(state(j, "paid")).toBe("done");
  });

  it("tracks the water request through to served", () => {
    const ev = (kind: string, at: string) => ({ kind, occurredAt: at });
    const requested = buildJourney({
      settings: on,
      events: [ev("water_requested", T)],
      order: null,
    })!;
    expect(state(requested, "water")).toBe("active");
    expect(requested.needsStaff).toBe(true);
    const served = buildJourney({
      settings: on,
      events: [ev("water_requested", T), ev("water_served", "2026-11-02T12:03:00.000Z")],
      order: null,
    })!;
    expect(state(served, "water")).toBe("done");
    expect(served.needsStaff).toBe(false);
    expect(served.waterAction).toBeNull();
  });

  it("offers the next staff step on an open water request", () => {
    const base = { settings: on, order: null };
    const requested = buildJourney({
      ...base,
      events: [{ kind: "water_requested", occurredAt: T, refId: "req-1" }],
    })!;
    expect(requested.waterAction).toEqual({ requestId: "req-1", action: "acknowledge" });
    const seen = buildJourney({
      ...base,
      events: [
        { kind: "water_requested", occurredAt: T, refId: "req-1" },
        { kind: "water_acknowledged", occurredAt: "2026-11-02T12:01:00.000Z", refId: "req-1" },
      ],
    })!;
    expect(seen.waterAction).toEqual({ requestId: "req-1", action: "resolve" });
  });

  it("flags a guest bill request until the bill is shown or paid", () => {
    const requested = { kind: "bill_requested", occurredAt: T };
    expect(
      buildJourney({ settings: on, events: [requested], order: order("served") })!.needsStaff
    ).toBe(true);
    const shown = { kind: "bill_presented", occurredAt: "2026-11-02T12:01:00.000Z" };
    const j = buildJourney({ settings: on, events: [requested, shown], order: order("served") })!;
    expect(j.needsStaff).toBe(false);
    expect(state(j, "bill")).toBe("done");
  });

  it("hides steps whose source is switched off", () => {
    const j = buildJourney({
      settings: {
        ...on,
        qrScanPings: false,
        guestWaterButton: false,
        showKitchen: false,
        showPosBill: false,
      },
      events: [{ kind: "qr_scanned", occurredAt: T }],
      order: order("preparing"),
    })!;
    expect(j.steps.map((s) => s.key)).toEqual(["order", "delivered"]);
  });
});
