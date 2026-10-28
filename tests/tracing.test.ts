import { describe, it, expect } from "vitest";
import {
  createTraceContext,
  getTraceContext,
  runWithTrace,
  setTraceContext,
} from "../src/lib/tracing";

describe("Tracing & AsyncLocalStorage Context", () => {
  it("returns undefined outside of a trace boundary", () => {
    expect(getTraceContext()).toBeUndefined();
  });

  it("stores and retrieves trace context across asynchronous Promise chains", async () => {
    const ctx = createTraceContext({
      traceId: "test-trace-1234",
      method: "GET",
      path: "/api/test",
    });

    const result = await runWithTrace(ctx, async () => {
      await new Promise((r) => setTimeout(r, 10));
      const active = getTraceContext();
      expect(active).toBeDefined();
      expect(active?.traceId).toBe("test-trace-1234");
      expect(active?.method).toBe("GET");
      expect(active?.path).toBe("/api/test");
      return "done";
    });

    expect(result).toBe("done");
    expect(getTraceContext()).toBeUndefined();
  });

  it("maintains isolation between concurrent asynchronous executions", async () => {
    const ctxA = createTraceContext({ traceId: "trace-AAA" });
    const ctxB = createTraceContext({ traceId: "trace-BBB" });

    const taskA = runWithTrace(ctxA, async () => {
      await new Promise((r) => setTimeout(r, 20));
      return getTraceContext()?.traceId;
    });

    const taskB = runWithTrace(ctxB, async () => {
      await new Promise((r) => setTimeout(r, 10));
      return getTraceContext()?.traceId;
    });

    const [resA, resB] = await Promise.all([taskA, taskB]);
    expect(resA).toBe("trace-AAA");
    expect(resB).toBe("trace-BBB");
  });

  it("allows enriching trace context in-place via setTraceContext", () => {
    const ctx = createTraceContext({ traceId: "root-trace" });

    runWithTrace(ctx, () => {
      expect(getTraceContext()?.outletId).toBeUndefined();
      setTraceContext({
        outletId: "outlet_456",
        actorId: "user_789",
        organizationId: "org_101",
      });

      const updated = getTraceContext();
      expect(updated?.outletId).toBe("outlet_456");
      expect(updated?.actorId).toBe("user_789");
      expect(updated?.organizationId).toBe("org_101");
    });
  });

  it("restores parent trace context after nested runWithTrace completes", async () => {
    const parentCtx = createTraceContext({ traceId: "parent-trace" });
    const childCtx = createTraceContext({ traceId: "child-trace" });

    await runWithTrace(parentCtx, async () => {
      expect(getTraceContext()?.traceId).toBe("parent-trace");

      await runWithTrace(childCtx, async () => {
        expect(getTraceContext()?.traceId).toBe("child-trace");
      });

      expect(getTraceContext()?.traceId).toBe("parent-trace");
    });
  });
});
