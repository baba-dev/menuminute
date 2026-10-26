const requestIdPattern = /^[A-Za-z0-9._-]{8,64}$/;
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
  const pathname = (() => {
    try {
      return new URL(request.url).pathname;
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
