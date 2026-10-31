import { describe, expect, it } from "vitest";
import {
  ageLabel,
  arrivals,
  attentionCount,
  connectionState,
  deriveAlerts,
  formatMinor,
  type ClientShellSnapshot,
} from "../src/modules/dashboard/notification-model";

const NOW = Date.parse("2027-01-02T12:00:00.000Z");
const iso = (minutesAgo: number) => new Date(NOW - minutesAgo * 60_000).toISOString();

function snapshot(over: Partial<ClientShellSnapshot> = {}): ClientShellSnapshot {
  return {
    outletId: "o1",
    checkedAt: iso(0),
    pulse: {
      state: "ready",
      data: { pending: 0, preparing: 0, ready: 0, active: 0, completedToday: 0 },
    },
    requests: { state: "ready", data: { open: 0, unacknowledged: 0, oldestAt: null } },
    till: { state: "restricted", data: null },
    ...over,
  };
}
const withPulse = (over: object) =>
  snapshot({
    pulse: {
      state: "ready",
      data: { pending: 0, preparing: 0, ready: 0, active: 0, completedToday: 0, ...over },
    },
  });
const withRequests = (open: number, unacknowledged: number, oldestAt: string | null) =>
  snapshot({ requests: { state: "ready", data: { open, unacknowledged, oldestAt } } });

describe("connection state", () => {
  const base = { online: true, lastSuccessAt: NOW - 5_000, lastFailureAt: null, now: NOW };
  it("is live after a recent success", () => {
    expect(connectionState(base)).toBe("live");
    expect(connectionState({ ...base, lastSuccessAt: null })).toBe("live");
  });
  it("is offline whenever the browser has no network", () => {
    expect(connectionState({ ...base, online: false })).toBe("offline");
  });
  it("is reconnecting after a failure that follows the last success, or when data goes stale", () => {
    expect(connectionState({ ...base, lastFailureAt: NOW - 1_000 })).toBe("reconnecting");
    expect(connectionState({ ...base, lastSuccessAt: NOW - 120_000 })).toBe("reconnecting");
    expect(connectionState({ ...base, lastSuccessAt: null, lastFailureAt: NOW })).toBe(
      "reconnecting"
    );
  });
  it("recovers to live once a success follows the failure", () => {
    expect(connectionState({ ...base, lastFailureAt: NOW - 20_000 })).toBe("live");
  });
});

describe("alerts", () => {
  it("is empty when everything is quiet", () => {
    expect(deriveAlerts(snapshot(), "live", NOW)).toEqual([]);
    expect(attentionCount(snapshot(), "live")).toBe(0);
  });

  it("raises waiting orders and ready handoffs with correct grammar and links", () => {
    const one = deriveAlerts(withPulse({ pending: 1, ready: 1 }), "live", NOW);
    expect(one.map((a) => a.title)).toEqual([
      "1 order awaits acceptance",
      "1 order is ready for handoff",
    ]);
    const many = deriveAlerts(withPulse({ pending: 3, ready: 2 }), "live", NOW);
    expect(many.map((a) => a.title)).toEqual([
      "3 orders await acceptance",
      "2 orders are ready for handoff",
    ]);
    expect(many[0]!.href).toBe("/dashboard/orders");
  });

  it("escalates a guest request that has waited more than ten minutes", () => {
    const fresh = deriveAlerts(withRequests(1, 1, iso(2)), "live", NOW);
    expect(fresh[0]).toMatchObject({ id: "requests-waiting", severity: "warning" });
    const old = deriveAlerts(withRequests(1, 1, iso(15)), "live", NOW);
    expect(old[0]).toMatchObject({ severity: "critical" });
    expect(old[0]!.detail).toContain("15 min");
  });

  it("separates waiting from in-progress requests", () => {
    const alerts = deriveAlerts(withRequests(3, 1, iso(1)), "live", NOW);
    expect(alerts.map((a) => [a.id, a.count])).toEqual([
      ["requests-waiting", 1],
      ["requests-progress", 2],
    ]);
  });

  it("never reads an unavailable source as all-clear", () => {
    const alerts = deriveAlerts(
      snapshot({
        pulse: { state: "unavailable", data: null },
        requests: { state: "unavailable", data: null },
      }),
      "live",
      NOW
    );
    expect(alerts.map((a) => a.id)).toEqual(["orders-unavailable", "requests-unavailable"]);
    expect(alerts.every((a) => a.detail.startsWith("Do not assume"))).toBe(true);
  });

  it("stays silent about sources the user has no permission for", () => {
    const alerts = deriveAlerts(
      snapshot({
        pulse: { state: "restricted", data: null },
        requests: { state: "restricted", data: null },
      }),
      "live",
      NOW
    );
    expect(alerts).toEqual([]);
  });

  it("flags a till left open for a long time, but not a recent one", () => {
    const till = (openedAt: string) =>
      snapshot({
        till: {
          state: "ready",
          data: { open: true, registers: 1, currency: "OMR", expectedMinor: "100", openedAt },
        },
      });
    expect(deriveAlerts(till(iso(60)), "live", NOW)).toEqual([]);
    expect(deriveAlerts(till(iso(17 * 60)), "live", NOW)[0]).toMatchObject({
      id: "till-stale",
      href: "/dashboard/pos/closing",
    });
  });

  it("puts connection problems first, and says so even with no data yet", () => {
    const offline = deriveAlerts(withPulse({ pending: 2 }), "offline", NOW);
    expect(offline[0]).toMatchObject({ id: "connection", severity: "critical" });
    expect(deriveAlerts(null, "offline", NOW)).toHaveLength(1);
    expect(deriveAlerts(null, "live", NOW)).toEqual([]);
    expect(deriveAlerts(null, "reconnecting", NOW)[0]).toMatchObject({ severity: "warning" });
  });

  it("counts only things that need a person for the bell", () => {
    const busy = snapshot({
      pulse: {
        state: "ready",
        data: { pending: 2, preparing: 4, ready: 3, active: 9, completedToday: 20 },
      },
      requests: { state: "ready", data: { open: 3, unacknowledged: 1, oldestAt: iso(1) } },
    });
    expect(attentionCount(busy, "live")).toBe(3);
    expect(attentionCount(busy, "offline")).toBe(4);
    expect(attentionCount(null, "live")).toBe(0);
  });
});

describe("arrivals (the only trigger for a chime)", () => {
  it("fires for newly waiting orders and requests, not for existing ones", () => {
    expect(arrivals(withPulse({ pending: 1 }), withPulse({ pending: 3 }))).toEqual({
      orders: 2,
      requests: 0,
    });
    expect(arrivals(withRequests(1, 1, iso(1)), withRequests(3, 2, iso(1)))).toEqual({
      orders: 0,
      requests: 1,
    });
    expect(arrivals(withPulse({ pending: 3 }), withPulse({ pending: 3 }))).toEqual({
      orders: 0,
      requests: 0,
    });
    expect(arrivals(withPulse({ pending: 3 }), withPulse({ pending: 1 }))).toEqual({
      orders: 0,
      requests: 0,
    });
  });

  it("never fires on first load, across outlets, or when a source was unreadable", () => {
    expect(arrivals(null, withPulse({ pending: 9 }))).toEqual({ orders: 0, requests: 0 });
    expect(arrivals(snapshot({ outletId: "other" }), withPulse({ pending: 9 }))).toEqual({
      orders: 0,
      requests: 0,
    });
    const blind = snapshot({ pulse: { state: "unavailable", data: null } });
    expect(arrivals(blind, withPulse({ pending: 9 }))).toEqual({ orders: 0, requests: 0 });
  });
});

describe("formatting", () => {
  it("labels ages in plain words", () => {
    expect(ageLabel(iso(0), NOW)).toBe("just now");
    expect(ageLabel(iso(7), NOW)).toBe("7 min ago");
    expect(ageLabel(iso(150), NOW)).toBe("2 h ago");
    expect(ageLabel(iso(60 * 50), NOW)).toBe("2 d ago");
    expect(ageLabel(null, NOW)).toBe("");
    expect(ageLabel("nope", NOW)).toBe("");
  });

  it("formats minor units using the currency's own exponent, from an exact string", () => {
    expect(formatMinor("31000", "OMR", "en")).toMatch(/31\.000/);
    expect(formatMinor("31250", "INR", "en")).toMatch(/312\.50/);
    expect(formatMinor("500", "JPY", "en")).toMatch(/500/);
    expect(formatMinor("-250", "INR", "en")).toMatch(/-.*2\.50/);
    expect(formatMinor("5", "INR", "en")).toMatch(/0\.05/);
    expect(formatMinor("abc", "INR", "en")).toBe("—");
  });
});
