import { describe, expect, it } from "vitest";
import { shouldReconcileKitchen } from "@/modules/kitchen/reconciliation-policy";

describe("kitchen SSE reconciliation policy", () => {
  it("reconciles at the established 15-second tick when the stream is unhealthy", () => {
    expect(shouldReconcileKitchen(false, 15_000)).toBe(true);
  });
  it("skips redundant full GETs while stream snapshots and heartbeats remain healthy", () => {
    expect(shouldReconcileKitchen(true, 15_000)).toBe(false);
  });
  it("always performs a periodic authoritative GET, even with live SSE", () => {
    expect(shouldReconcileKitchen(true, 30_000)).toBe(true);
  });
});
