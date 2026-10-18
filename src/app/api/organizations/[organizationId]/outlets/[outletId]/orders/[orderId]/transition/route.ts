import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { transitionOutletOrder } from "@/modules/orders/service";

export async function POST(
  req: Request,
  context: { params: Promise<{ organizationId: string; outletId: string; orderId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId, orderId } = await context.params;
    const body = await req.json();

    const result = await transitionOutletOrder(actor, outletId, orderId, body, organizationId);
    if (result.expired) return NextResponse.json({ message: "The order acceptance window has expired." }, { status: 409 });

    return NextResponse.json(result, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
