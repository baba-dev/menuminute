import { expect, it, vi } from "vitest";
import { observedRoute } from "../src/lib/observed-route";
import { getTraceContext } from "../src/lib/tracing";
import { telemetry } from "../src/lib/telemetry";

it("records successful and failed responses exactly once, and establishes trace context", async () => {
  telemetry.reset();
  const observed = observedRoute(async (request: Request) => {
    await Promise.resolve();
    expect(getTraceContext()?.traceId).toBe(request.headers.get("x-request-id"));
    return Response.json({ ok: true });
  });
  const request = new Request("https://menu.invalid/api/health?secret=1", {
    headers: { "x-request-id": "123e4567-e89b-42d3-a456-426614174000" },
  });
  const result = await observed(request);
  expect(result.status).toBe(200);
  expect(telemetry.getSnapshot().statusCodes["2xx"]).toBe(1);
  expect(telemetry.getSnapshot().requestsTotal).toBe(1);
  expect(getTraceContext()).toBeUndefined();
});

it("records unhandled exceptions without leaking their details", async () => {
  telemetry.reset();
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    const observed = observedRoute(async (_request: Request): Promise<Response> => {
      throw new Error("Bearer do-not-log-secret");
    });
    await expect(observed(new Request("https://menu.invalid/api/failure"))).rejects.toThrow();
    expect(telemetry.getSnapshot().statusCodes["5xx"]).toBe(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("do-not-log-secret");
  } finally { log.mockRestore(); }
});
