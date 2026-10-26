import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { serviceOrderActivity } from "@/modules/orders/workspace";
export async function GET(
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
