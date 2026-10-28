import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { kitchenWorkCommand } from "@/modules/kitchen/service";
async function observed_POST(
  req: Request,
  { params }: { params: Promise<{ organizationId: string; outletId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const data = await kitchenWorkCommand(actor, organizationId, outletId, await req.json());
    return NextResponse.json(data, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
