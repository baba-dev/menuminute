import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { dashboardPulseSnapshot } from "@/modules/menu-product/dashboard-optional-pulse";
import { preferredMenuQr } from "@/modules/menu-product/dashboard-summary";

const actor = { userId: "scope-owner", sessionId: "valid-session" };
const counters = { pending: 2, preparing: 3, ready: 1, active: 6, completedToday: 7 };

describe("dashboard production service-pulse contract", () => {
  it("returns scoped service counters with an ISO snapshot time", async () => {
    const reader = vi.fn(async () => counters);
    const result = await dashboardPulseSnapshot(actor, "org-a", "outlet-a", reader);
    expect(result.state).toBe("ready");
    if (result.state !== "ready") throw new Error("Expected accessible service activity");
    expect(result.data).toEqual(counters);
    expect(Date.parse(result.checkedAt)).not.toBeNaN();
    expect(reader).toHaveBeenCalledExactlyOnceWith(actor, "org-a", "outlet-a");
  });

  it("treats revoked role access as restricted without leaking or retrying another outlet", async () => {
    const reader = vi.fn(async () => {
      throw new ForbiddenError();
    });
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const result = await dashboardPulseSnapshot(actor, "org-a", "outlet-a", reader);
      expect(result.state).toBe("restricted");
      expect(result.data).toBeNull();
      expect(reader).toHaveBeenCalledTimes(1);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });

  it("reports dependency failures without serializing query text or credentials", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const error = Object.assign(new Error("secret SQL with password"), { code: "42703" });
    try {
      const result = await dashboardPulseSnapshot(actor, "org-a", "outlet-a", async () => {
        throw error;
      });
      expect(result.state).toBe("unavailable");
      expect(result.data).toBeNull();
      expect(spy).toHaveBeenCalledWith("[dashboard] Service pulse query failed", {
        kind: "Error",
        sqlstate: "42703",
      });
      expect(JSON.stringify(spy.mock.calls)).not.toContain("secret SQL");
    } finally {
      spy.mockRestore();
    }
  });

  it("does not log malformed error details or unsafe SQLSTATE values", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await dashboardPulseSnapshot(actor, "org-a", "outlet-a", async () => {
        throw { code: "super-secret", password: "should-not-be-logged" };
      });
      expect(spy).toHaveBeenCalledWith("[dashboard] Service pulse query failed", {
        kind: "unknown",
        sqlstate: undefined,
      });
      expect(JSON.stringify(spy.mock.calls)).not.toContain("should-not-be-logged");
    } finally {
      spy.mockRestore();
    }
  });
});

describe("deterministic canonical QR selection", () => {
  it("is independent of database row order and never falls back to inactive/order links", () => {
    const qr = [
      {
        id: "z",
        destinationToken: "z-token",
        isActive: true,
        purpose: "menu",
        tableId: null,
        createdAt: new Date("2026-02-02"),
      },
      {
        id: "c",
        destinationToken: "table-token",
        isActive: true,
        purpose: "menu",
        tableId: "table-1",
        createdAt: new Date("2025-01-01"),
      },
      {
        id: "a",
        destinationToken: "a-token",
        isActive: true,
        purpose: "menu",
        tableId: null,
        createdAt: new Date("2025-02-02"),
      },
      {
        id: "0",
        destinationToken: "revoked",
        isActive: false,
        purpose: "menu",
        tableId: null,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "1",
        destinationToken: "order",
        isActive: true,
        purpose: "order",
        tableId: null,
        createdAt: new Date("2023-01-01"),
      },
    ];
    expect(preferredMenuQr(qr)?.destinationToken).toBe("a-token");
    expect(preferredMenuQr([...qr].reverse())?.destinationToken).toBe("a-token");
    expect(preferredMenuQr(qr.filter((code) => code.tableId !== null))?.destinationToken).toBe(
      "table-token"
    );
    expect(preferredMenuQr(qr.filter((code) => !code.isActive))).toBeNull();
  });
});
