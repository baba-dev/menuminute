import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import crypto from "node:crypto";
import { requestActor, errorResponse } from "@/lib/request-context";
import { withActor } from "@/modules/tenancy/service";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { isPlayClient } from "@/lib/app-distribution";
import {
  isPlausiblePurchaseToken,
  playProductForSku,
  reconcilePlayPurchase,
} from "@/modules/billing/play";

const noStore = { "cache-control": "private, no-store" };

/**
 * Called by the Play app after a purchase (and on every launch for restore). The client supplies only a
 * purchase token. We bind it to this owner's organization, re-query Google Play, and only then does the
 * restricted billing identity create the entitlement. The response never contains the token or grant ids.
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
    const body: unknown = await boundedJson(req);
    const { purchaseToken, sku } =
      body !== null && typeof body === "object"
        ? (body as { purchaseToken?: unknown; sku?: unknown })
        : { purchaseToken: undefined, sku: undefined };
    if (!isPlausiblePurchaseToken(purchaseToken) || typeof sku !== "string")
      throw new ValidationError("Invalid purchase");
    const product = playProductForSku(sku);
    if (!product) throw new ValidationError("Unknown product");

    // Owner-only binding of this token to this organization (database-enforced, never re-bindable).
    await withActor(actor, async (tx) => {
      await tx.execute(
        sql`SELECT app_private.register_play_purchase(${purchaseToken},${organizationId},${product})`
      );
    });
    const result = await reconcilePlayPurchase({
      eventId: `verify:${crypto.randomUUID()}`,
      token: purchaseToken,
    });
    return NextResponse.json(
      { state: result.state, entitled: result.entitled },
      { headers: noStore }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const POST = observedRoute(observed_POST);
