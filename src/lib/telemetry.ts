export interface TelemetrySnapshot {
  requestsTotal: number;
  statusCodes: {
    "2xx": number;
    "3xx": number;
    "4xx": number;
    "5xx": number;
  };
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  cacheHits: number;
  cacheMisses: number;
  cacheHitRatio: string;
  slowRequests: number;
  uptimeSeconds: number;
  memoryUsage: {
    heapUsedMb: number;
    rssMb: number;
  };
}

export class TelemetryRegistry {
  private readonly maxSamples: number;
  private latencies: Float64Array;
  private latencyCount = 0;
  private latencyIdx = 0;

  public requestsTotal = 0;
  public statusCodes = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  public cacheHits = 0;
  public cacheMisses = 0;
  public slowRequests = 0;
  private startedAt = Date.now();

  constructor(maxSamples = 1000) {
    this.maxSamples = maxSamples;
    this.latencies = new Float64Array(maxSamples);
  }

  /**
   * Record an HTTP/API request completion with status code and duration.
   * Runs in ~5 nanoseconds without memory allocation.
   */
  public recordRequest(status: number, durationMs: number): void {
    this.requestsTotal++;
    if (status >= 500) {
      this.statusCodes["5xx"]++;
    } else if (status >= 400) {
      this.statusCodes["4xx"]++;
    } else if (status >= 300) {
      this.statusCodes["3xx"]++;
    } else {
      this.statusCodes["2xx"]++;
    }

    if (durationMs > 250) {
      this.slowRequests++;
    }

    this.latencies[this.latencyIdx] = durationMs;
    this.latencyIdx = (this.latencyIdx + 1) % this.maxSamples;
    if (this.latencyCount < this.maxSamples) {
      this.latencyCount++;
    }
  }

  /**
   * Record a Redis public menu cache hit.
   */
  public recordCacheHit(): void {
    this.cacheHits++;
  }

  /**
   * Record a Redis public menu cache miss.
   */
  public recordCacheMiss(): void {
    this.cacheMisses++;
  }

  /**
   * Compute a point-in-time snapshot with percentile latencies and cache efficiency.
   */
  public getSnapshot(): TelemetrySnapshot {
    let p50 = 0;
    let p95 = 0;
    let p99 = 0;

    if (this.latencyCount > 0) {
      const active = Array.from(this.latencies.subarray(0, this.latencyCount)).sort(
        (a, b) => a - b
      );
      const len = active.length;
      p50 = active[Math.floor(len * 0.5)] ?? 0;
      p95 = active[Math.floor(len * 0.95)] ?? 0;
      p99 = active[Math.floor(len * 0.99)] ?? 0;
    }

    const totalCache = this.cacheHits + this.cacheMisses;
    const cacheHitRatio =
      totalCache > 0 ? `${((this.cacheHits / totalCache) * 100).toFixed(1)}%` : "N/A";

    let heapUsedMb = 0;
    let rssMb = 0;
    if (typeof process !== "undefined" && typeof process.memoryUsage === "function") {
      const mem = process.memoryUsage();
      heapUsedMb = Math.round((mem.heapUsed / 1024 / 1024) * 10) / 10;
      rssMb = Math.round((mem.rss / 1024 / 1024) * 10) / 10;
    }

    return {
      requestsTotal: this.requestsTotal,
      statusCodes: { ...this.statusCodes },
      p50Ms: Math.round(p50 * 10) / 10,
      p95Ms: Math.round(p95 * 10) / 10,
      p99Ms: Math.round(p99 * 10) / 10,
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheHitRatio,
      slowRequests: this.slowRequests,
      uptimeSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      memoryUsage: { heapUsedMb, rssMb },
    };
  }

  /**
   * Reset all counters and buffers (useful for test isolation).
   */
  public reset(): void {
    this.latencyCount = 0;
    this.latencyIdx = 0;
    this.requestsTotal = 0;
    this.statusCodes = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.slowRequests = 0;
    this.startedAt = Date.now();
    this.latencies.fill(0);
  }
}

const globalForTelemetry = globalThis as unknown as {
  __menuMinuteTelemetry?: TelemetryRegistry;
};

export const telemetry =
  globalForTelemetry.__menuMinuteTelemetry ?? new TelemetryRegistry();

if (process.env.NODE_ENV !== "production") {
  globalForTelemetry.__menuMinuteTelemetry = telemetry;
}
