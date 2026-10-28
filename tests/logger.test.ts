import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { logger, redactSensitiveData, setLogLevel, getLogLevel } from "../src/lib/logger";
import { createTraceContext, runWithTrace } from "../src/lib/tracing";

describe("High-Performance Structured Logger", () => {
  let initialLogLevel = getLogLevel();

  beforeEach(() => {
    initialLogLevel = getLogLevel();
    setLogLevel("debug");
  });

  afterEach(() => {
    setLogLevel(initialLogLevel);
  });

  it("outputs valid NDJSON with level and message", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      logger.info("Order status changed", { orderId: "ord_123" });
      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0]![0]);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Order status changed");
      expect(parsed.orderId).toBe("ord_123");
      expect(parsed.timestamp).toBeDefined();
    } finally {
      logSpy.mockRestore();
    }
  });

  it("automatically attaches active trace context", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      const trace = createTraceContext({
        traceId: "trace-999",
        outletId: "outlet-888",
        actorId: "usr-777",
      });

      runWithTrace(trace, () => {
        logger.info("Diner visited menu");
      });

      expect(logSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(logSpy.mock.calls[0]![0]);
      expect(parsed.traceId).toBe("trace-999");
      expect(parsed.outletId).toBe("outlet-888");
      expect(parsed.actorId).toBe("usr-777");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("respects log level thresholds and skips low-priority logs with zero output", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      setLogLevel("warn");
      logger.debug("Verbose debug information");
      logger.info("Routine informational event");
      expect(logSpy).not.toHaveBeenCalled();

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        logger.warn("Slow query detected");
        expect(warnSpy).toHaveBeenCalledTimes(1);
      } finally {
        warnSpy.mockRestore();
      }
    } finally {
      logSpy.mockRestore();
    }
  });

  it("redacts sensitive fields in metadata deeply", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      logger.info("Authentication attempt", {
        user: "owner@restaurant.com",
        password: "SuperSecretPassword123!",
        totpSecret: "JBSWY3DPEHPK3PXP",
        sessionToken: "eyJhbGciOi...",
        nested: {
          apiKey: "sk_live_xyz",
          cardCvv: "123",
          safeField: "acceptable",
        },
      });

      const parsed = JSON.parse(logSpy.mock.calls[0]![0]);
      expect(parsed.password).toBe("[REDACTED]");
      expect(parsed.totpSecret).toBe("[REDACTED]");
      expect(parsed.sessionToken).toBe("[REDACTED]");
      expect(parsed.nested.apiKey).toBe("[REDACTED]");
      expect(parsed.nested.cardCvv).toBe("[REDACTED]");
      expect(parsed.nested.safeField).toBe("acceptable");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("redacts Bearer tokens found in strings", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      logger.info("Header parsed", {
        authHeader: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz",
      });
      const parsed = JSON.parse(logSpy.mock.calls[0]![0]);
      expect(parsed.authHeader).toBe("Bearer [REDACTED]");
    } finally {
      logSpy.mockRestore();
    }
  });

  it("safely handles circular references without throwing or stack overflowing", () => {
    const circular: Record<string, unknown> = { name: "cycle" };
    circular["self"] = circular;

    const sanitized = redactSensitiveData(circular) as Record<string, unknown>;
    expect(sanitized["name"]).toBe("cycle");
    expect(sanitized["self"]).toBe("[CIRCULAR]");
  });

  it("serializes errors accurately to console.error", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const err = new Error("Connection failed");
      logger.error("Database check failed", err, { attempt: 3 });

      expect(errSpy).toHaveBeenCalledTimes(1);
      const parsed = JSON.parse(errSpy.mock.calls[0]![0]);
      expect(parsed.level).toBe("error");
      expect(parsed.message).toBe("Database check failed");
      expect(parsed.attempt).toBe(3);
      expect(parsed.error.name).toBe("Error");
      expect(parsed.error.message).toBe("Connection failed");
    } finally {
      errSpy.mockRestore();
    }
  });
});
