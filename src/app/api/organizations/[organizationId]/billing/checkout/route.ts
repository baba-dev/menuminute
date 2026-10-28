import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { withActor } from "@/modules/tenancy/service";
import { sql } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { createRazorpaySubscription, verifyBillingWriterReady } from "@/modules/billing/razorpay";
import { PAID_PLAN_CATALOG } from "@/modules/billing/catalog";

async function observed_POST(
  req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId } = await context.params;

    if (!env.RAZORPAY_ENABLED)
      throw new ValidationError("Subscriptions are not enabled on this deployment.");
    if (env.COMMUNITY_EDITION) {
      throw new ValidationError(
        "Self-hosted Community Edition has all features unlocked without subscriptions."
      );
    }

    // Check authorization and active entitlements BEFORE calling the payment provider.
    const current = await withActor(actor, async (tx) => {
      const check = await tx.execute<{ allowed: boolean }>(
        sql`SELECT app_private.org_admin(${organizationId}, true, true) as allowed`
      );
      if (!check.rows[0]?.allowed)
        throw new ForbiddenError("Only organization owners can manage subscriptions");
      const existing = await tx.execute<{ subscriptions: unknown }>(
        sql`SELECT app_private.razorpay_subscription_state(${organizationId}) AS subscriptions`
      );
      const grants = await tx.execute<{ ordering: boolean; kitchen: boolean }>(
        sql`SELECT app_private.entitlement_allowed(${organizationId},'ordering.new') AS ordering,
          app_private.entitlement_allowed(${organizationId},'kitchen.new') AS kitchen`
      );
      return { subscriptions: existing.rows[0]?.subscriptions, grants: grants.rows[0] };
    });

    const body: unknown = await req.json();
    const plan =
      body !== null && typeof body === "object" && "plan" in body ? body.plan : undefined;
    if (plan !== "ordering" && plan !== "kitchen_pro") {
      throw new ValidationError("Invalid plan. Choose 'ordering' or 'kitchen_pro'");
    }

    if (plan === "kitchen_pro" && !env.RAZORPAY_KITCHEN_ENABLED)
      throw new ValidationError("Kitchen Pro paid activation is not approved yet.");
    const planId =
      plan === "kitchen_pro" ? env.RAZORPAY_PLAN_KITCHEN_ID : env.RAZORPAY_PLAN_ORDERING_ID;
    if (!planId) throw new ValidationError("Provider plan is not configured.");

    if (
      (plan === "ordering" && current.grants?.ordering) ||
      (plan === "kitchen_pro" && current.grants?.kitchen)
    )
      throw new ValidationError("This organization already has an active entitlement.");

    // Fail before calling Razorpay if entitlement reconciliation cannot complete.
    await verifyBillingWriterReady();
    const amountPaise = PAID_PLAN_CATALOG[plan].monthlyPricePaise;
    const reservation = await withActor(actor, async (tx) => {
      const row = await tx.execute<{
        reservation: { state: string; subscriptionId?: string; requestKey?: string };
      }>(sql`SELECT app_private.begin_razorpay_checkout(${organizationId},${plan}) AS reservation`);
      return row.rows[0]?.reservation;
    });
    if (!reservation || reservation.state === "in_progress")
      throw new ValidationError("Another checkout is already in progress. Please retry shortly.");
    if (reservation.state !== "reserved" && reservation.state !== "ready")
      throw new ValidationError("Unable to reserve checkout");

    const sub =
      reservation.state === "ready" && reservation.subscriptionId
        ? { id: reservation.subscriptionId }
        : await createRazorpaySubscription({ planId, organizationId });

    if (reservation.state === "reserved") {
      if (!reservation.requestKey) throw new ValidationError("Checkout reservation was lost");
      await withActor(actor, async (tx) => {
        await tx.execute(sql`SELECT app_private.complete_razorpay_checkout(
          ${organizationId},${plan},${reservation.requestKey},${sub.id},${planId}
        )`);
      });
    }

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

export const POST = observedRoute(observed_POST);
