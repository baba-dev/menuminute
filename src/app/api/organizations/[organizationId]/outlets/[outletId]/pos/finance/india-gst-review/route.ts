import { NextResponse } from "next/server";
import { observedRoute } from "@/lib/observed-route";
import { boundedJson } from "@/lib/bounded-input";
import { requestActor, errorResponse } from "@/lib/request-context";
import { financeReviewIndiaGst } from "@/modules/pos/finance";

type Context = { params: Promise<{ organizationId: string; outletId: string }> };

/**
 * Pre-issuance review ONLY. Deliberately no GET to avoid caching buyer details.
 * Requires authenticated, CSRF-verified account plus existing POS document role.
 * The response contains draft calculations and blockers, never an invoice.
 */
async function observed_POST(req: Request, { params }: Context) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const review = await financeReviewIndiaGst(
      actor,
      organizationId,
      outletId,
      await boundedJson(req)
    );
    return NextResponse.json(review, {
      headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
export const POST = observedRoute(observed_POST);
