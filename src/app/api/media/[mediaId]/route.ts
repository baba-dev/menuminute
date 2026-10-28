import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestContext, errorResponse } from "@/lib/request-context";
import { privateMedia, mediaCommand } from "@/modules/media/product-service";
type C = { params: Promise<{ mediaId: string }> };
async function observed_GET(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req);
    return new Response(
      new Uint8Array(await privateMedia(actor, restaurant.id, (await c.params).mediaId)),
      { headers: { "content-type": "image/webp", "cache-control": "private, no-store" } }
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_PATCH(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const data = z
      .object({ action: z.enum(["approve", "unapprove"]) })
      .strict()
      .parse(await req.json());
    return NextResponse.json(
      await mediaCommand(actor, restaurant.id, (await c.params).mediaId, data.action)
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const PATCH = observedRoute(observed_PATCH);
