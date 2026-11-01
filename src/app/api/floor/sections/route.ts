import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { createSection } from "@/modules/hospitality/floor-service";
import { createSectionInputSchema } from "@/modules/hospitality/floor-contracts";

async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const input = createSectionInputSchema.parse(await boundedJson(req));
    return NextResponse.json(await createSection(actor, restaurant.id, input), { status: 201 });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
