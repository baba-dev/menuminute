import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { removeChair, updateChair } from "@/modules/hospitality/floor-service";
import { updateChairInputSchema } from "@/modules/hospitality/floor-contracts";

type C = { params: Promise<{ chairId: string }> };

async function observed_PATCH(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const input = updateChairInputSchema.parse(await boundedJson(req));
    await updateChair(actor, restaurant.id, (await c.params).chairId, input);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, req);
  }
}

async function observed_DELETE(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    await removeChair(actor, restaurant.id, (await c.params).chairId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const PATCH = observedRoute(observed_PATCH);
export const DELETE = observedRoute(observed_DELETE);
