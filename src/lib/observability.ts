import { telemetry } from "./telemetry";

const requestIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const generatedIds = new WeakMap<Request, string>();

export function requestId(request: Request) {
  const supplied = request.headers.get("x-request-id");
  if (supplied && requestIdPattern.test(supplied)) return supplied;
  const existing = generatedIds.get(request);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  generatedIds.set(request, generated);
  return generated;
}

export function logRequestError(request: Request, error: unknown, status: number) {
  const startHeader = request.headers.get("x-request-start");
  const durationMs = startHeader ? Math.max(0, Date.now() - Number(startHeader)) : 0;
  telemetry.recordRequest(status, durationMs);

  const pathname = (() => {
    try {
      // Report endpoint families only: never log tokens, user IDs or customer identifiers.
      return "/" + new URL(request.url).pathname.split("/").filter(Boolean).slice(0, 2).join("/");
    } catch {
      return "invalid-url";
    }
  })();
  const record = {
    timestamp: new Date().toISOString(),
    level: "error",
    event: "http.request.failed",
    requestId: requestId(request),
    method: request.method,
    path: pathname,
    status,
    errorType: error instanceof Error ? error.name : "UnknownError",
  };
  const line = JSON.stringify(record);
  // Expected client errors are returned with correlation IDs without creating attacker-controlled
  // log volume. Authorization/audit events belong in their domain-specific durable records.
  if (status >= 500) console.error(line);
}
