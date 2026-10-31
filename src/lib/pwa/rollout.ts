import { env } from "@/lib/config/env";

/** Server-only rollout decision. Product activation and RBAC remain separate authorities. */
export function pwaOperationalEnabledForOutlet(outletId: string) {
  return env.PWA_OPERATIONAL_ENABLED && env.PWA_OPERATIONAL_OUTLET_IDS.includes(outletId);
}
