import { describe, expect, it, beforeEach } from "vitest";
import { TelemetryRegistry } from "../src/lib/telemetry";
describe("validated process telemetry", () => {
  let t: TelemetryRegistry;
  beforeEach(() => { t = new TelemetryRegistry(4); });
  it("distinguishes lifespan totals and bounded latency sample window", () => {
    for (let i = 1; i <= 12; i++) t.recordRequest(200, i * 10);
    const s = t.getSnapshot();
    expect(s.requestsTotal).toBe(12);
    expect(s.latencySamples).toBe(4);
    expect(s.p50Ms).toBe(110);
    expect(s.scope).toBe("process");
  });
  it("rejects invalid measurements", () => {
    t.recordRequest(0, 12);
    t.recordRequest(200, Number.NaN);
    t.recordRequest(200, -9);
    expect(t.getSnapshot().requestsTotal).toBe(0);
    expect(t.getSnapshot().invalidSamples).toBe(3);
  });
  it("classifies cache failures separately", () => {
    t.recordCacheMiss(); t.recordCacheError(); t.recordCacheCorrupt(); t.recordCacheFallback();
    const s = t.getSnapshot();
    expect(s.cacheHitRatio).toBe("0.0%");
    expect(s.cacheErrors).toBe(1);
    expect(s.cacheCorrupt).toBe(1);
    expect(s.cacheFallbacks).toBe(1);
  });
});
