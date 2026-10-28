import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { saveOutletProfile } from "@/modules/restaurants/profile";
async function observed_PATCH(
  req: Request,
  { params }: { params: Promise<{ organizationId: string; outletId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    return NextResponse.json(
      await saveOutletProfile(actor, organizationId, outletId, await req.json()),
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const PATCH = observedRoute(observed_PATCH);
