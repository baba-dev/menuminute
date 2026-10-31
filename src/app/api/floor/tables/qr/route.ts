import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { attachExistingTableQr } from "@/modules/hospitality/floor-service";
import { z } from "zod";

async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const { tableId } = z.object({ tableId: z.string().min(1).max(128) }).strict().parse(await req.json());
    return NextResponse.json(await attachExistingTableQr(actor, restaurant.id, tableId));
  } catch (error) {
    return errorResponse(error, req);
  }
}
export const POST = observedRoute(observed_POST);
