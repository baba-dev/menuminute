import { logger } from "./logger";
import { requestId } from "./observability";
import { telemetry } from "./telemetry";
import { createTraceContext, runWithTrace } from "./tracing";

export function endpointFamily(request: Request): string {
  try {
    const parts = new URL(request.url).pathname.split("/").filter(Boolean);
    return "/" + parts.slice(0, 2).join("/");
  } catch {
    return "/unknown";
  }
}

/**
 * Route-level Node ALS boundary. Next's proxy cannot propagate an ALS scope
 * into route handlers. Wrap each route export to record its final status once.
 * This also works for handlers receiving Next.js dynamic route context.
 */
export function observedRoute<T extends (request: never, ...args: never[]) => unknown>(
  handler: T
): T {
  const wrapped = async (...args: Parameters<T>) => {
    const request = args[0] as Request;
    const started = performance.now();
    const traceId = requestId(request);
    return runWithTrace(
      createTraceContext({
        traceId,
        method: request.method,
        path: endpointFamily(request),
        metadata: { observedRequest: true },
      }),
      async () => {
        try {
          const response: unknown = await Reflect.apply(handler, undefined, args);
          const status = response instanceof Response ? response.status : 500;
          const duration = performance.now() - started;
          telemetry.recordRequest(status, duration);
          if (status >= 500) {
            logger.warn("HTTP request returned server error", {
              event: "http.request.failed",
              route: endpointFamily(request),
              method: request.method,
              status,
              durationMs: Math.round(duration),
            });
          }
          return response;
        } catch (error) {
          telemetry.recordRequest(500, performance.now() - started);
          logger.error("Unhandled API request exception", error, {
            event: "http.request.exception",
            route: endpointFamily(request),
            method: request.method,
          });
          throw error;
        }
      }
    );
  };
  return wrapped as T;
}
