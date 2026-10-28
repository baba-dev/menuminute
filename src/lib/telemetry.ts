export interface TelemetrySnapshot {
  requestsTotal: number;
  statusCodes: { "2xx": number; "3xx": number; "4xx": number; "5xx": number };
  p50Ms: number; p95Ms: number; p99Ms: number;
  latencySamples: number;
  latencyWindowSeconds: number;
  slowRequests: number; invalidSamples: number;
  cacheHits: number; cacheMisses: number; cacheHitRatio: string;
  cacheErrors: number; cacheCorrupt: number; cacheFallbacks: number;
  uptimeSeconds: number; capturedAt: string; scope: "process";
  memoryUsage: { heapUsedMb: number; rssMb: number };
}
const LATENCY_WINDOW_MS = 5 * 60 * 1000;
export class TelemetryRegistry {
  private readonly maxSamples: number;
  private readonly latencies: Float64Array;
  private readonly times: Float64Array;
  private latencyCount = 0;
  private latencyIdx = 0;
  public requestsTotal = 0;
  public statusCodes = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
  public cacheHits = 0; public cacheMisses = 0;
  public cacheErrors = 0; public cacheCorrupt = 0; public cacheFallbacks = 0;
  public slowRequests = 0; public invalidSamples = 0;
  private startedAt = Date.now();
  constructor(maxSamples = 1000) {
    if (!Number.isSafeInteger(maxSamples) || maxSamples < 1 || maxSamples > 100_000)
      throw new RangeError("Invalid telemetry capacity");
    this.maxSamples = maxSamples;
    this.latencies = new Float64Array(maxSamples);
    this.times = new Float64Array(maxSamples);
  }
  public recordRequest(status: number, durationMs: number): void {
    if (!Number.isSafeInteger(status) || status < 200 || status > 599 ||
        !Number.isFinite(durationMs) || durationMs < 0 || durationMs > 3_600_000) {
      this.invalidSamples++;
      return;
    }
    this.requestsTotal++;
    if (status >= 500) this.statusCodes["5xx"]++;
    else if (status >= 400) this.statusCodes["4xx"]++;
    else if (status >= 300) this.statusCodes["3xx"]++;
    else this.statusCodes["2xx"]++;
    if (durationMs > 250) this.slowRequests++;
    this.latencies[this.latencyIdx] = durationMs;
    this.times[this.latencyIdx] = Date.now();
    this.latencyIdx = (this.latencyIdx + 1) % this.maxSamples;
    if (this.latencyCount < this.maxSamples) this.latencyCount++;
  }
  public recordCacheHit() { this.cacheHits++; }
  public recordCacheMiss() { this.cacheMisses++; }
  public recordCacheError() { this.cacheErrors++; }
  public recordCacheCorrupt() { this.cacheCorrupt++; }
  public recordCacheFallback() { this.cacheFallbacks++; }
  public getSnapshot(): TelemetrySnapshot {
    const now = Date.now();
    const active: number[] = [];
    for (let i = 0; i < this.latencyCount; i++) {
      if (now - this.times[i]! <= LATENCY_WINDOW_MS) active.push(this.latencies[i]!);
    }
    active.sort((a, b) => a - b);
    const at = (fraction: number) =>
      active.length ? Math.round((active[Math.floor(active.length * fraction)] ?? 0) * 10) / 10 : 0;
    const cacheTotal = this.cacheHits + this.cacheMisses;
    const mem = process.memoryUsage();
    return {
      requestsTotal: this.requestsTotal,
      statusCodes: { ...this.statusCodes },
      p50Ms: at(0.5), p95Ms: at(0.95), p99Ms: at(0.99),
      latencySamples: active.length, latencyWindowSeconds: LATENCY_WINDOW_MS / 1000,
      slowRequests: this.slowRequests, invalidSamples: this.invalidSamples,
      cacheHits: this.cacheHits, cacheMisses: this.cacheMisses,
      cacheHitRatio: cacheTotal ? ((100 * this.cacheHits) / cacheTotal).toFixed(1) + "%" : "N/A",
      cacheErrors: this.cacheErrors, cacheCorrupt: this.cacheCorrupt,
      cacheFallbacks: this.cacheFallbacks,
      uptimeSeconds: Math.floor((now - this.startedAt) / 1000),
      capturedAt: new Date(now).toISOString(), scope: "process",
      memoryUsage: {
        heapUsedMb: Math.round(mem.heapUsed / 104857.6) / 10,
        rssMb: Math.round(mem.rss / 104857.6) / 10,
      },
    };
  }
  public reset() {
    this.latencyCount = 0; this.latencyIdx = 0;
    this.requestsTotal = 0;
    this.statusCodes = { "2xx": 0, "3xx": 0, "4xx": 0, "5xx": 0 };
    this.cacheHits = 0; this.cacheMisses = 0; this.cacheErrors = 0;
    this.cacheCorrupt = 0; this.cacheFallbacks = 0;
    this.slowRequests = 0; this.invalidSamples = 0; this.startedAt = Date.now();
    this.latencies.fill(0); this.times.fill(0);
  }
}
const globalForTelemetry = globalThis as unknown as { __menuMinuteTelemetry?: TelemetryRegistry };
export const telemetry = globalForTelemetry.__menuMinuteTelemetry ?? new TelemetryRegistry();
if (process.env.NODE_ENV !== "production") globalForTelemetry.__menuMinuteTelemetry = telemetry;
