import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { clearTable, seatTable } from "@/modules/hospitality/floor-service";
import { seatTableInputSchema } from "@/modules/hospitality/floor-contracts";

type C = { params: Promise<{ tableId: string }> };

/** Seat a party: occupy `guests` free chairs, or every free chair when omitted. */
async function observed_POST(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const { guests } = seatTableInputSchema.parse(await req.json());
    return NextResponse.json(await seatTable(actor, restaurant.id, (await c.params).tableId, guests));
  } catch (e) {
    return errorResponse(e, req);
  }
}

/** Clear the table: free every chair. */
async function observed_DELETE(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(await clearTable(actor, restaurant.id, (await c.params).tableId));
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
export const DELETE = observedRoute(observed_DELETE);
