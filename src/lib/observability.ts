import { getTraceContext } from "./tracing";
import { telemetry } from "./telemetry";

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const generatedIds = new WeakMap<Request, string>();
export function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id");
  if (supplied && requestIdPattern.test(supplied)) return supplied;
  const previous = generatedIds.get(request);
  if (previous) return previous;
  const next = crypto.randomUUID();
  generatedIds.set(request, next);
  return next;
}

export function logRequestError(request: Request, error: unknown, status: number): void {
  const trace = getTraceContext();
  // Observed routes record final status exactly once in observedRoute.
  if (trace?.metadata?.["observedRequest"] !== true) {
    const startHeader = request.headers.get("x-request-start");
    const candidate = startHeader ? Number(startHeader) : NaN;
    const duration = Number.isFinite(candidate) && candidate > 0 &&
      candidate <= Date.now() ? Date.now() - candidate : 0;
    telemetry.recordRequest(status, duration);
  }
  // Preserve existing conservative error event format: no messages, URLs or stack traces.
  if (status >= 500) {
    let path = "/unknown";
    try {
      path = "/" + new URL(request.url).pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    } catch { /* No user URL content in fallback. */ }
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(), level: "error", event: "http.request.failed",
      requestId: requestId(request), method: request.method, path, status,
      errorType: error instanceof Error ? error.name : "UnknownError",
    }));
  }
}
