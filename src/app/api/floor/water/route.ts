import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { staffServiceRequestAction } from "@/modules/hospitality/service";

/** Staff: acknowledge or resolve a water request from the floor. Authorization lives in the database. */
async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(
      await staffServiceRequestAction(
        actor,
        restaurant.organizationId,
        restaurant.id,
        await boundedJson(req)
      )
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
