import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { getRestaurantQrCodes } from "@/modules/restaurants/service";
import { qrCommand } from "@/modules/menu-product/service";
async function observed_GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    const rows = await getRestaurantQrCodes(actor, restaurant.id);
    return NextResponse.json(
      rows.map(({ id, label, destinationToken, isActive, tableId, pointLabel }) => ({
        id,
        label,
        destinationToken,
        isActive,
        tableId,
        pointLabel,
      }))
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(await qrCommand(actor, restaurant.id, await req.json()));
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
