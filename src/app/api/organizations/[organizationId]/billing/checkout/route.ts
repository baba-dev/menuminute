import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { withActor } from "@/modules/tenancy/service";
import { sql } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { createRazorpaySubscription } from "@/modules/billing/razorpay";

export async function POST(
  req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId } = await context.params;

    if (env.COMMUNITY_EDITION) {
      throw new ValidationError(
        "Self-hosted Community Edition has all features unlocked without subscriptions."
      );
    }

    // Verify actor is organization owner
    await withActor(actor, async (tx) => {
      const check = await tx.execute<{ allowed: boolean }>(
        sql`SELECT app_private.org_admin(${organizationId}, true, true) as allowed`
      );
      if (!check.rows[0]?.allowed) {
        throw new ForbiddenError("Only organization owners can manage subscriptions");
      }
    });

    const body = await req.json();
    const plan = body?.plan;
    if (plan !== "ordering" && plan !== "kitchen_pro") {
      throw new ValidationError("Invalid plan. Choose 'ordering' or 'kitchen_pro'");
    }

    const planId =
      plan === "kitchen_pro"
        ? env.RAZORPAY_PLAN_KITCHEN_ID || "plan_KITCHEN_299"
        : env.RAZORPAY_PLAN_ORDERING_ID || "plan_ORDERING_119";

    const amountPaise = plan === "kitchen_pro" ? 29900 : 11900;

    const sub = await createRazorpaySubscription({
      planId,
      organizationId,
    });

    return NextResponse.json({
      subscriptionId: sub.id,
      keyId: env.RAZORPAY_KEY_ID,
      planId,
      amount: amountPaise,
      currency: "INR",
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}
