import { NextResponse } from "next/server";
import { observedRoute } from "@/lib/observed-route";
import { boundedJson } from "@/lib/bounded-input";
import { requestActor, errorResponse } from "@/lib/request-context";
import {
  getOutletReceiptPayment,
  saveOutletReceiptPayment,
} from "@/modules/receipt-payment/service";
type Context = { params: Promise<{ organizationId: string; outletId: string }> };

async function observed_GET(req: Request, { params }: Context) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    const profile = await getOutletReceiptPayment(actor, organizationId, outletId);
    return NextResponse.json(profile, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_PATCH(req: Request, { params }: Context) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const profile = await saveOutletReceiptPayment(
      actor,
      organizationId,
      outletId,
      await boundedJson(req)
    );
    return NextResponse.json(profile, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}
export const GET = observedRoute(observed_GET);
export const PATCH = observedRoute(observed_PATCH);
