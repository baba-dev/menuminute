import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { getFloorOverview } from "@/modules/hospitality/floor-service";

/** Live floor read model: sections, tables with chairs, derived occupancy and totals. */
async function observed_GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    return NextResponse.json(await getFloorOverview(actor, restaurant.id), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
