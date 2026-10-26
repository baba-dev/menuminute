import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { recordOutletOrderPayment } from "@/modules/orders/service";

export async function POST(
  req: Request,
  context: {
    params: Promise<{ organizationId: string; outletId: string; orderId: string }>;
  }
) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId, orderId } = await context.params;
    const body = await req.json();
    const result = await recordOutletOrderPayment(actor, outletId, orderId, organizationId, body);
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}
