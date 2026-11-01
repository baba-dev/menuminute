import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { archiveTable, updateTable } from "@/modules/hospitality/floor-service";
import { updateTableInputSchema } from "@/modules/hospitality/floor-contracts";

type C = { params: Promise<{ tableId: string }> };

async function observed_PATCH(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const input = updateTableInputSchema.parse(await boundedJson(req));
    await updateTable(actor, restaurant.id, (await c.params).tableId, input);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, req);
  }
}

/** Archive (never hard delete): blocked by open orders, bookings, a live QR or seated guests. */
async function observed_DELETE(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    await archiveTable(actor, restaurant.id, (await c.params).tableId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const PATCH = observedRoute(observed_PATCH);
export const DELETE = observedRoute(observed_DELETE);
