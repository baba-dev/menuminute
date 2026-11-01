import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { setChairOccupied } from "@/modules/hospitality/floor-service";
import { setChairOccupiedInputSchema } from "@/modules/hospitality/floor-contracts";

type C = { params: Promise<{ chairId: string }> };

/** The one-tap command: PUT the desired state, optionally with the version the screen saw. */
async function observed_PUT(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const { occupied, version } = setChairOccupiedInputSchema.parse(await boundedJson(req));
    return NextResponse.json(
      await setChairOccupied(actor, restaurant.id, (await c.params).chairId, occupied, version)
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const PUT = observedRoute(observed_PUT);
