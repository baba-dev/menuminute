import { describe, expect, it, vi } from "vitest";
import { ForbiddenError } from "@/lib/errors";
import { ordersSqlState, recordOrdersReadFailure } from "@/modules/orders/diagnostics";

describe("Service Counter safe workspace diagnostics", () => {
  it("extracts only safe PostgreSQL SQLSTATE identifiers across wrapped causes", () => {
    expect(ordersSqlState({ cause: { code: "42703" } })).toBe("42703");
    expect(ordersSqlState({ code: "private-sql-token" })).toBeNull();
    expect(ordersSqlState(null)).toBeNull();
  });

  it("never lets malicious getters escape its failure handler", () => {
    const thrown = Object.defineProperty({}, "code", {
      get: () => {
        throw new Error("private diagnostic data");
      },
    });
    expect(ordersSqlState(thrown)).toBeNull();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => recordOrdersReadFailure("rail", "safe-ref", thrown)).not.toThrow();
      expect(log).toHaveBeenCalledWith("[orders] Workspace read unavailable", {
        view: "rail",
        requestId: "safe-ref",
        sqlstate: null,
        kind: "unknown",
      });
    } finally {
      log.mockRestore();
    }
  });

  it("redacts internal database errors and avoids logging authorization denials", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      recordOrdersReadFailure(
        "pulse",
        "request-1",
        Object.assign(new Error("secret SQL params"), { code: "42P01" })
      );
      expect(log).toHaveBeenCalledWith("[orders] Workspace read unavailable", {
        view: "pulse",
        requestId: "request-1",
        sqlstate: "42P01",
        kind: "error",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret SQL params");
      log.mockClear();
      recordOrdersReadFailure("history", "request-2", new ForbiddenError());
      expect(log).not.toHaveBeenCalled();
    } finally {
      log.mockRestore();
    }
  });
});
