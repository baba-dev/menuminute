#!/usr/bin/env node
/**
 * Read-only endpoint sampling. No production load amplification, credentials,
 * customer identifiers, mutations, or private response bodies are recorded.
 *
 * PERF_BASE_URL=https://food.bababuilds.com pnpm perf:baseline
 * PERF_PUBLIC_MENU_PATH=/m/<a-synthetic-test-qr> pnpm perf:baseline
 */
import { performance } from "node:perf_hooks";

const base = process.env.PERF_BASE_URL ?? "http://localhost:3000";
const samples = Number(process.env.PERF_SAMPLES ?? "5");
if (!Number.isInteger(samples) || samples < 1 || samples > 20)
  throw new Error("PERF_SAMPLES must be between 1 and 20");
const root = new URL(base);
if (
  !["https:", "http:"].includes(root.protocol) ||
  root.username ||
  root.password ||
  root.search ||
  root.hash
)
  throw new Error("PERF_BASE_URL must be an HTTP(S) origin without credentials or query strings");
const menuPath = process.env.PERF_PUBLIC_MENU_PATH;
if (menuPath && !/^\/m\/[A-Za-z0-9_-]{1,128}$/.test(menuPath))
  throw new Error("PERF_PUBLIC_MENU_PATH must be a non-sensitive /m/<test-token> path");
const endpoints = ["/", "/login", ...(menuPath ? [menuPath] : [])];
const percentile = (values, ratio) =>
  values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)];
const results = [];
for (const path of endpoints) {
  const timings = [];
  const statuses = new Set();
  for (let run = 0; run < samples; run++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    const start = performance.now();
    try {
      // No cookies or bearer credentials: only unauthenticated synthetic requests.
      const response = await fetch(new URL(path, root), {
        signal: controller.signal,
        headers: { "cache-control": "no-cache", accept: "text/html" },
        redirect: "manual",
      });
      timings.push(Math.round(performance.now() - start));
      statuses.add(response.status);
      await response.body?.cancel();
    } catch (error) {
      statuses.add("network-error");
      console.error(
        "Sampling failed for",
        path.startsWith("/m/") ? "/m/<test-token>" : path,
        error instanceof Error ? error.name : "unknown"
      );
      process.exitCode = 1;
    } finally {
      clearTimeout(timer);
    }
  }
  timings.sort((a, b) => a - b);
  results.push({
    route: path.startsWith("/m/") ? "/m/<test-token>" : path,
    responses: timings.length,
    statuses: [...statuses],
    p50Ms: timings.length ? percentile(timings, 0.5) : null,
    p95Ms: timings.length ? percentile(timings, 0.95) : null,
    maxMs: timings.at(-1) ?? null,
  });
}
console.log(
  JSON.stringify(
    { type: "menuminute-performance-baseline", at: new Date().toISOString(), samples, results },
    null,
    2
  )
);
