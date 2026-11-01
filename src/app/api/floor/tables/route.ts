import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { createTable } from "@/modules/hospitality/floor-service";
import { createTableInputSchema } from "@/modules/hospitality/floor-contracts";

async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const input = createTableInputSchema.parse(await req.json());
    return NextResponse.json(await createTable(actor, restaurant.id, input), { status: 201 });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
