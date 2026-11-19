import { env, type Env } from "@/lib/config/env";

type OperationalRollout = Pick<
  Env,
  "PWA_OPERATIONAL_ENABLED" | "PWA_OPERATIONAL_ALL_OUTLETS" | "PWA_OPERATIONAL_OUTLET_IDS"
>;
type PushRollout = Pick<Env, "PWA_PUSH_ENABLED" | "PWA_PUSH_ALL_OUTLETS" | "PWA_PUSH_OUTLET_IDS">;

export function pwaOperationalAllowed(config: OperationalRollout, outletId: string): boolean {
  return (
    outletId.length > 0 &&
    config.PWA_OPERATIONAL_ENABLED &&
    (config.PWA_OPERATIONAL_ALL_OUTLETS || config.PWA_OPERATIONAL_OUTLET_IDS.includes(outletId))
  );
}

export function pwaPushAllowed(config: PushRollout, outletId: string): boolean {
  return (
    outletId.length > 0 &&
    config.PWA_PUSH_ENABLED &&
    (config.PWA_PUSH_ALL_OUTLETS || config.PWA_PUSH_OUTLET_IDS.includes(outletId))
  );
}

/** Server-only rollout decision. Product activation and RBAC remain separate authorities. */
export function pwaOperationalEnabledForOutlet(outletId: string) {
  return pwaOperationalAllowed(env, outletId);
}

export function pwaPushEnabledForOutlet(outletId: string) {
  return pwaPushAllowed(env, outletId);
}
