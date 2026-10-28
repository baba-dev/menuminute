import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { menuDetail, commandMenu } from "@/modules/menu-product/service";
import { boundedJson } from "@/lib/bounded-input";
type C = { params: Promise<{ menuId: string }> };
async function observed_GET(req: Request, c: C) {
  try {
    const { actor } = await requestContext(req);
    return NextResponse.json(await menuDetail(actor, (await c.params).menuId));
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_PATCH(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(
      await commandMenu(actor, restaurant.id, (await c.params).menuId, await boundedJson(req))
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const PATCH = observedRoute(observed_PATCH);
