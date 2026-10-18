import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { listOutletOrders } from "@/modules/orders/service";

export async function GET(
  req: Request,
  context: { params: Promise<{ organizationId: string; outletId: string }> }
) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await context.params;
    const url = new URL(req.url);
    const statusFilter = url.searchParams.get("status") || undefined;

    const orders = await listOutletOrders(actor, outletId, statusFilter, organizationId);

    return NextResponse.json(orders, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
