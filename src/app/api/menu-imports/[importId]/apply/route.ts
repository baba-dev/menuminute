import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/lib/bounded-input";
import { applyReview } from "@/modules/menu-import/review";
type C = { params: Promise<{ importId: string }> };
async function observed_POST(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(
      await applyReview(actor, restaurant.id, (await c.params).importId, await boundedJson(req)),
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    return errorResponse(err, req);
  }
}

export const POST = observedRoute(observed_POST);
