import { AppError } from "@/lib/errors";
import { ZodError } from "zod";

export function ordersSqlState(error: unknown): string | null {
  // Drivers may wrap PostgreSQL errors in cause; access untrusted properties defensively.
  try {
    let current: unknown = error;
    for (let depth = 0; depth < 3; depth += 1) {
      if (!current || typeof current !== "object") break;
      const code: unknown = Reflect.get(current, "code");
      if (typeof code === "string" && /^[A-Z0-9]{5}$/.test(code)) return code;
      current = Reflect.get(current, "cause") as unknown;
    }
  } catch {
    // A malformed thrown object must never crash the route's failure handler.
  }
  return null;
}

export function recordOrdersReadFailure(view: string, requestId: string, error: unknown): void {
  if (error instanceof AppError || error instanceof ZodError) return;
  // No SQL text, parameter values, order/customer IDs, session details or raw error messages.
  console.error("[orders] Workspace read unavailable", {
    view: ["rail", "pulse", "history"].includes(view) ? view : "unknown",
    requestId,
    sqlstate: ordersSqlState(error),
    kind: error instanceof Error ? "error" : "unknown",
  });
}
