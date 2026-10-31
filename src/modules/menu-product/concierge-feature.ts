import { env } from "@/lib/config/env";

/** Explicit per-outlet rollout. No guest request can enable the feature. */
export function conciergeEnabledForOutlet(outletId: string) {
  return env.AI_DINING_CONCIERGE_ENABLED && env.AI_DINING_CONCIERGE_OUTLET_IDS.includes(outletId);
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
