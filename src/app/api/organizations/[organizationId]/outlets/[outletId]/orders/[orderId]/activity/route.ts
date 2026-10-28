import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { serviceOrderActivity } from "@/modules/orders/workspace";
async function observed_GET(
  req: Request,
  context: {
    params: Promise<{ organizationId: string; outletId: string; orderId: string }>;
  }
) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId, orderId } = await context.params;
    return NextResponse.json(await serviceOrderActivity(actor, organizationId, outletId, orderId), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
