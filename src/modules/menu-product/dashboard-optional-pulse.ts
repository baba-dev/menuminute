import { ForbiddenError } from "@/lib/errors";
import { servicePulse } from "@/modules/orders/workspace";
import type { Actor } from "@/modules/tenancy/service";

/**
 * The restaurant overview is a free-menu workspace. Order counters are a
 * strictly optional enhancement: failed/forbidden order reads must not take
 * down the menu KPIs, publishing links, QR information or setup guidance.
 *
 * Keep the service as the sole source of outlet-scoped counts. There is no
 * cross-outlet fallback, global query or synthetic success count.
 */
export async function optionalDashboardServicePulse(
  actor: Actor,
  organizationId: string,
  outletId: string,
  readPulse: typeof servicePulse = servicePulse
): Promise<Awaited<ReturnType<typeof servicePulse>> | null> {
  try {
    return await readPulse(actor, organizationId, outletId);
  } catch (error) {
    if (!(error instanceof ForbiddenError)) {
      // Do not serialize raw PostgreSQL errors: they can contain SQL or params.
      // SQLSTATE plus error kind is sufficient to correlate a server incident.
      const code =
        error && typeof error === "object" && "code" in error ? error.code : undefined;
      console.error("[dashboard] Optional service pulse unavailable", {
        kind: error instanceof Error ? error.name : "unknown",
        sqlstate: typeof code === "string" && /^[A-Z0-9]{5}$/.test(code) ? code : undefined,
      });
    }
    return null;
  }
}
