import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import {
  getFloorLayout,
  saveFloorLayout,
  getReservations,
} from "@/modules/hospitality/floor-service";
import { getOutletFloorMatrix } from "@/modules/hospitality/floor-matrix";
import { getRestaurantQrCodes } from "@/modules/restaurants/service";

async function observed_GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    const [layout, orderMatrix, qrCodes, reservations] = await Promise.all([
      getFloorLayout(actor, restaurant.id),
      getOutletFloorMatrix(actor, restaurant.organizationId, restaurant.id),
      getRestaurantQrCodes(actor, restaurant.id),
      getReservations(actor, restaurant.id),
    ]);

    return NextResponse.json({
      layout,
      orderMatrix,
      qrCodes: qrCodes.map(({ id, label, destinationToken, isActive, tableId, pointLabel }) => ({
        id,
        label,
        destinationToken,
        isActive,
        tableId,
        pointLabel,
      })),
      reservations,
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}

async function observed_PUT(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await req.json();
    const updated = await saveFloorLayout(actor, restaurant.id, body);
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const PUT = observedRoute(observed_PUT);
