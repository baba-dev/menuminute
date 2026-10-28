import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  logger,
  redactSensitiveData,
  redactLogString,
  setLogLevel,
  getLogLevel,
} from "../src/lib/logger";
import { createTraceContext, runWithTrace } from "../src/lib/tracing";

describe("Structured safe logging", () => {
  let previous = getLogLevel();
  beforeEach(() => {
    previous = getLogLevel();
    setLogLevel("debug");
  });
  afterEach(() => {
    setLogLevel(previous);
    vi.restoreAllMocks();
  });
  it("emits parseable NDJSON with nested metadata", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("order updated", { orderId: "ord_123" });
    const record = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(record.level).toBe("info");
    expect(record.meta.orderId).toBe("ord_123");
    expect(record.timestamp).toBeDefined();
  });
  it("does not allow metadata to overwrite trusted fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("safe", { message: "Bearer rawsecret", level: "fatal", traceId: "attacker" });
    const record = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(record.message).toBe("safe");
    expect(record.level).toBe("info");
    expect(record.meta.message).not.toContain("rawsecret");
  });
  it("redacts direct message credentials and email", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    logger.info("Bearer abcDef123 user@company.com token=private");
    const line = String(spy.mock.calls[0]?.[0]);
    expect(line).not.toContain("abcDef123");
    expect(line).not.toContain("private");
    expect(line).not.toContain("user@company.com");
  });
  it("redacts nested sensitive fields and errors", () => {
    const error = new Error("Authorization: Bearer privatepass");
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    logger.error("read failed", error, { password: "hi", nested: { apiKey: "secret", ok: "yes" } });
    const result = JSON.parse(String(spy.mock.calls[0]?.[0]));
    expect(result.meta.password).toBe("[REDACTED]");
    expect(result.meta.nested.apiKey).toBe("[REDACTED]");
    expect(result.meta.nested.ok).toBe("yes");
    expect(JSON.stringify(result)).not.toContain("privatepass");
  });
  it("ignores getters, circular links, and unsafe toJSON", () => {
    const item: Record<string, unknown> = { safe: "value" };
    Object.defineProperty(item, "sideEffect", {
      enumerable: true,
      get() {
        throw Error("called getter");
      },
    });
    item.self = item;
    item.toJSON = () => {
      throw Error("called toJSON");
    };
    const safe = redactSensitiveData(item) as Record<string, unknown>;
    expect(safe.sideEffect).toBe("[ACCESSOR]");
    expect(safe.self).toBe("[CIRCULAR]");
    expect(JSON.stringify(safe)).not.toContain("called");
  });
  it("propagates trusted async context", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    runWithTrace(createTraceContext({ traceId: "trusted-trace" }), () => logger.info("ok"));
    expect(JSON.parse(String(spy.mock.calls[0]?.[0])).traceId).toBe("trusted-trace");
  });
  it("filters low priority levels without output", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    setLogLevel("warn");
    logger.debug("no");
    logger.info("no");
    expect(spy).not.toHaveBeenCalled();
  });
  it("redacts URLs containing query strings", () => {
    expect(redactLogString("https://example.com/menu?access=SECRET")).not.toContain("SECRET");
  });
});
