import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { updateSignalSettings } from "@/modules/hospitality/floor-service";
import { signalSettingsInputSchema } from "@/modules/hospitality/floor-contracts";

async function observed_PUT(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const input = signalSettingsInputSchema.parse(await boundedJson(req));
    return NextResponse.json(await updateSignalSettings(actor, restaurant.id, input));
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const PUT = observedRoute(observed_PUT);
