import { NextResponse } from "next/server";
import { observedRoute } from "@/lib/observed-route";
import { boundedJson } from "@/lib/bounded-input";
import { requestActor, errorResponse } from "@/lib/request-context";
import { getOutletSalesTax, saveOutletSalesTax } from "@/modules/tax/service";
type Context = { params: Promise<{ organizationId: string; outletId: string }> };

async function observed_GET(req: Request, { params }: Context) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    const policy = await getOutletSalesTax(actor, organizationId, outletId);
    return NextResponse.json(policy, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_PATCH(req: Request, { params }: Context) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const policy = await saveOutletSalesTax(actor, organizationId, outletId, await boundedJson(req));
    return NextResponse.json(policy, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}
export const GET = observedRoute(observed_GET);
export const PATCH = observedRoute(observed_PATCH);
