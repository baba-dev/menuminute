import { describe, it, expect, beforeEach } from "vitest";
import { TelemetryRegistry, telemetry } from "../src/lib/telemetry";

describe("In-Memory Telemetry Registry", () => {
  let registry: TelemetryRegistry;

  beforeEach(() => {
    registry = new TelemetryRegistry(100); // 100 sample ring buffer for test
  });

  it("initializes with empty baseline values", () => {
    const snap = registry.getSnapshot();
    expect(snap.requestsTotal).toBe(0);
    expect(snap.p50Ms).toBe(0);
    expect(snap.p95Ms).toBe(0);
    expect(snap.p99Ms).toBe(0);
    expect(snap.cacheHitRatio).toBe("N/A");
    expect(snap.slowRequests).toBe(0);
  });

  it("categorizes status codes into 2xx, 3xx, 4xx, 5xx buckets", () => {
    registry.recordRequest(200, 15);
    registry.recordRequest(201, 20);
    registry.recordRequest(301, 10);
    registry.recordRequest(400, 5);
    registry.recordRequest(404, 8);
    registry.recordRequest(500, 300);

    const snap = registry.getSnapshot();
    expect(snap.requestsTotal).toBe(6);
    expect(snap.statusCodes["2xx"]).toBe(2);
    expect(snap.statusCodes["3xx"]).toBe(1);
    expect(snap.statusCodes["4xx"]).toBe(2);
    expect(snap.statusCodes["5xx"]).toBe(1);
    expect(snap.slowRequests).toBe(1); // 300ms is > 250ms
  });

  it("calculates accurate percentiles (p50, p95, p99) over rolling latencies", () => {
    // Record latencies 1ms to 100ms
    for (let i = 1; i <= 100; i++) {
      registry.recordRequest(200, i);
    }

    const snap = registry.getSnapshot();
    expect(snap.requestsTotal).toBe(100);
    // p50 is at index 50 -> 51
    expect(snap.p50Ms).toBe(51);
    // p95 is at index 95 -> 96
    expect(snap.p95Ms).toBe(96);
    // p99 is at index 99 -> 100
    expect(snap.p99Ms).toBe(100);
  });

  it("handles ring buffer rollover without unbounded growth", () => {
    const smallRegistry = new TelemetryRegistry(5);
    for (let i = 1; i <= 15; i++) {
      smallRegistry.recordRequest(200, i);
    }

    const snap = smallRegistry.getSnapshot();
    expect(snap.requestsTotal).toBe(15);
    // Last 5 elements should be 11, 12, 13, 14, 15
    // p50 of [11, 12, 13, 14, 15] (len 5, idx 2) -> 13
    expect(snap.p50Ms).toBe(13);
  });

  it("tracks cache hits and misses and formats cache hit ratio correctly", () => {
    registry.recordCacheHit();
    registry.recordCacheHit();
    registry.recordCacheHit();
    registry.recordCacheMiss();

    const snap = registry.getSnapshot();
    expect(snap.cacheHits).toBe(3);
    expect(snap.cacheMisses).toBe(1);
    expect(snap.cacheHitRatio).toBe("75.0%");
  });

  it("resets state when reset() is called", () => {
    registry.recordRequest(200, 50);
    registry.recordCacheHit();
    expect(registry.getSnapshot().requestsTotal).toBe(1);

    registry.reset();
    const snap = registry.getSnapshot();
    expect(snap.requestsTotal).toBe(0);
    expect(snap.cacheHits).toBe(0);
    expect(snap.cacheHitRatio).toBe("N/A");
  });

  it("exports a working singleton instance", () => {
    expect(telemetry).toBeInstanceOf(TelemetryRegistry);
  });
});
