import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requestActor, errorResponse } from "@/lib/request-context";
import { withActor } from "@/modules/tenancy/service";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { requestRazorpayCancellation } from "@/modules/billing/razorpay";

export async function POST(
  req: Request,
  context: { params: Promise<{ organizationId: string; subscriptionId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    if (!env.RAZORPAY_ENABLED || env.COMMUNITY_EDITION)
      throw new ValidationError("Subscription changes are unavailable");
    const { organizationId, subscriptionId } = await context.params;
    await withActor(actor, async (tx) => {
      const owner = await tx.execute<{ allowed: boolean }>(
        sql`SELECT app_private.org_admin(${organizationId},true,false) AS allowed`
      );
      if (!owner.rows[0]?.allowed) throw new ForbiddenError("Owner access required");
      const record = await tx.execute<{ subscriptions: unknown }>(
        sql`SELECT app_private.razorpay_subscription_state(${organizationId}) AS subscriptions`
      );
      const subscriptions = record.rows[0]?.subscriptions;
      const allowed =
        Array.isArray(subscriptions) &&
        subscriptions.some(
          (item: { subscriptionId?: string; status?: string; cancelRequestedAt?: string | null }) =>
            item.subscriptionId === subscriptionId &&
            ["active", "authenticated", "pending", "created"].includes(item.status ?? "") &&
            !item.cancelRequestedAt
        );
      if (!allowed) throw new ValidationError("Subscription is not eligible for cancellation");
    });

    // Preserve paid access: only schedule cancellation at the end of the billing cycle.
    await requestRazorpayCancellation(subscriptionId);
    await withActor(actor, async (tx) => {
      await tx.execute(
        sql`SELECT app_private.mark_razorpay_cancel_requested(${organizationId},${subscriptionId})`
      );
    });
    return NextResponse.json({ status: "cancellation_scheduled" });
  } catch (error) {
    return errorResponse(error, req);
  }
}
