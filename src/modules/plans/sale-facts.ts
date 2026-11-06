import { env } from "@/lib/config/env";
import { NOTHING_FOR_SALE, type SaleFacts } from "./sale";

/**
 * Non-secret, per-request sale facts for public pages, read from the same switches checkout enforces
 * (`RAZORPAY_ENABLED`, the provider plan IDs, `RAZORPAY_KITCHEN_ENABLED`, `COMMUNITY_EDITION`).
 * Only presence is checked; no key, plan ID or secret is returned.
 *
 * Kitchen Pro checkout additionally needs the database release approval
 * (`app_private.kitchen_commerce_enabled()`). That is deliberately not read here, because a public page
 * has no actor. `/billing` and the checkout route both enforce it and say so plainly, so the worst case
 * is a signed-in owner landing on a Billing card that explains Kitchen Pro is not available yet.
 */
export function publicSaleFacts(): SaleFacts {
  try {
    if (env.COMMUNITY_EDITION) return { ...NOTHING_FOR_SALE, community: true };
    const checkoutOpen = env.RAZORPAY_ENABLED && Boolean(env.RAZORPAY_PLAN_ORDERING_ID);
    return {
      community: false,
      checkoutOpen,
      kitchenCheckoutOpen:
        checkoutOpen && env.RAZORPAY_KITCHEN_ENABLED && Boolean(env.RAZORPAY_PLAN_KITCHEN_ID),
    };
  } catch {
    // Never let an availability lookup break a public page, and never over-promise on failure.
    return NOTHING_FOR_SALE;
  }
}
