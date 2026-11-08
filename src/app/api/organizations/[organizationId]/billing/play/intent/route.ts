import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { requestActor, errorResponse } from "@/lib/request-context";
import { withActor } from "@/modules/tenancy/service";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { isPlayClient } from "@/lib/app-distribution";
import { playCatalog } from "@/modules/billing/play";

const noStore = { "cache-control": "private, no-store" };

/**
 * Pre-purchase check, called by the Play app before it opens the Google Play purchase sheet. It only
 * answers "may this owner start a Play subscription now?" and returns the catalog SKU. It grants nothing.
 */
async function observed_POST(
  req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const actor = await requestActor(req, true, { verified: true });
    if (!(await isPlayClient()))
      throw new ForbiddenError("Google Play purchases are only available in the Android app.");
    if (!env.PLAY_BILLING_ENABLED || env.COMMUNITY_EDITION)
      throw new ValidationError("Subscriptions are not enabled on this deployment.");
    const { organizationId } = await context.params;
    const blocker = await withActor(actor, async (tx) => {
      const owner = await tx.execute<{ allowed: boolean }>(
        sql`SELECT app_private.org_admin(${organizationId},true,false) AS allowed`
      );
      if (!owner.rows[0]?.allowed)
        throw new ForbiddenError("Only organization owners can manage subscriptions");
      const row = await tx.execute<{ blocker: string | null }>(
        sql`SELECT app_private.play_checkout_blocker(${organizationId}) AS blocker`
      );
      return row.rows[0]?.blocker ?? null;
    });
    if (blocker === "razorpay")
      throw new ValidationError(
        "This organization is already subscribed on the web. Manage that subscription from the website."
      );
    if (blocker)
      throw new ValidationError("This organization already has an active plan or purchase.");
    const { sku, basePlanId } = playCatalog().ordering;
    return NextResponse.json(
      { product: "ordering", sku, basePlanId, paymentMethod: "https://play.google.com/billing" },
      { headers: noStore }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const POST = observedRoute(observed_POST);
