import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { kitchenAvailableDishes, kitchenSetAvailability } from "@/modules/hospitality/service";
type Params = { params: Promise<{ organizationId: string; outletId: string }> };
const headers = { "cache-control": "private, no-store" };
async function observed_GET(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    return NextResponse.json(await kitchenAvailableDishes(actor, organizationId, outletId), {
      headers,
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_POST(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    return NextResponse.json(
      await kitchenSetAvailability(actor, organizationId, outletId, await req.json()),
      { headers }
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
