import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/lib/bounded-input";
import { saveReview } from "@/modules/menu-import/review";
type C = { params: Promise<{ importId: string }> };
export async function PUT(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(
      await saveReview(actor, restaurant.id, (await c.params).importId, await boundedJson(req)),
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (err) {
    return errorResponse(err, req);
  }
}
