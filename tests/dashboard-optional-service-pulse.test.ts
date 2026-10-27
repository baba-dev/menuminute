import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { optionalDashboardServicePulse } from "@/modules/menu-product/dashboard-optional-pulse";

const actor = { userId: "authorized-owner" };
const org = "org-1";
const outlet = "outlet-1";
const pulse = { pending: 2, preparing: 1, ready: 3, active: 6, completedToday: 4 };

describe("optional dashboard order counters", () => {
  it("returns authorized, outlet-scoped order counters unchanged", async () => {
    const query = vi.fn(async () => pulse);
    await expect(optionalDashboardServicePulse(actor, org, outlet, query)).resolves.toEqual(pulse);
    expect(query).toHaveBeenCalledExactlyOnceWith(actor, org, outlet);
  });

  it("does not execute any cross-outlet fallback after access is revoked", async () => {
    const query = vi.fn(async () => {
      throw new ForbiddenError();
    });
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(optionalDashboardServicePulse(actor, org, outlet, query)).resolves.toBeNull();
      expect(query).toHaveBeenCalledTimes(1);
      expect(report).not.toHaveBeenCalled();
    } finally {
      report.mockRestore();
    }
  });

  it("keeps the overview available and emits only safe PostgreSQL diagnostics", async () => {
    const dbFailure = Object.assign(new Error("private query text and secret params"), {
      code: "42703",
    });
    const query = vi.fn(async () => {
      throw dbFailure;
    });
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(optionalDashboardServicePulse(actor, org, outlet, query)).resolves.toBeNull();
      expect(report).toHaveBeenCalledWith("[dashboard] Optional service pulse unavailable", {
        kind: "Error",
        sqlstate: "42703",
      });
      expect(JSON.stringify(report.mock.calls)).not.toContain("secret params");
      expect(query).toHaveBeenCalledTimes(1);
    } finally {
      report.mockRestore();
    }
  });

  it("redacts malformed database codes and handles non-Error rejections", async () => {
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(
        optionalDashboardServicePulse(actor, org, outlet, async () => {
          throw { code: "private-payload", data: { password: "never-log-this" } };
        })
      ).resolves.toBeNull();
      expect(report).toHaveBeenCalledWith("[dashboard] Optional service pulse unavailable", {
        kind: "unknown",
        sqlstate: undefined,
      });
      expect(JSON.stringify(report.mock.calls)).not.toContain("never-log-this");
    } finally {
      report.mockRestore();
    }
  });
  it("emits a nested SQLSTATE while redacting the underlying query and parameters", async () => {
    const { dashboardPulseSnapshot } = await import("@/modules/menu-product/dashboard-optional-pulse");
    const error = Object.assign(new Error("driver wrapper"), {
      cause: Object.assign(new Error("secret SELECT query"), { code: "22023" }),
    });
    const query = vi.fn(async () => { throw error; });
    const report = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(dashboardPulseSnapshot(actor, org, outlet, query)).resolves.toMatchObject({
        state: "unavailable",
        data: null,
      });
      expect(report).toHaveBeenCalledWith("[dashboard] Service pulse query failed", {
        kind: "Error",
        sqlstate: "22023",
      });
      expect(JSON.stringify(report.mock.calls)).not.toContain("secret SELECT");
    } finally {
      report.mockRestore();
    }
  });

});
