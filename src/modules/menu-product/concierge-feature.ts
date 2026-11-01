import { env, type Env } from "@/lib/config/env";

type ConciergeRollout = Pick<
  Env,
  | "AI_DINING_CONCIERGE_ENABLED"
  | "AI_DINING_CONCIERGE_ALL_OUTLETS"
  | "AI_DINING_CONCIERGE_OUTLET_IDS"
>;

/**
 * Shared authorization predicate for both the public menu projection and guest API.
 * A publicProduct lookup remains mandatory: this only selects outlets, never publishes
 * drafts or makes revoked QR tokens valid.
 */
export function conciergeOutletAllowed(config: ConciergeRollout, outletId: string): boolean {
  return (
    outletId.length > 0 &&
    config.AI_DINING_CONCIERGE_ENABLED &&
    (config.AI_DINING_CONCIERGE_ALL_OUTLETS ||
      config.AI_DINING_CONCIERGE_OUTLET_IDS.includes(outletId))
  );
}

/** Operator-only rollout; a guest request cannot change the policy. */
export function conciergeEnabledForOutlet(outletId: string): boolean {
  return conciergeOutletAllowed(env, outletId);
}

/** A distinct NVIDIA-only route; Cloudflare capacity remains reserved for Ember. */
export function conciergeNvidiaReady() {
  return (
    env.AI_FEATURES_ENABLED &&
    env.AI_NVIDIA_ENABLED &&
    env.AI_NVIDIA_COMMERCIAL_APPROVED &&
    Boolean(env.NVIDIA_API_KEY && env.AI_NVIDIA_MODEL)
  );
}
