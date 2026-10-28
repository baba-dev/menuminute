import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, requestContext, errorResponse } from "@/lib/request-context";
import { uploadDishPhoto } from "@/modules/media/product-service";
import { mediaList } from "@/modules/menu-product/service";
import { boundedBytes } from "@/lib/bounded-input";
import { env } from "@/lib/config/env";
import { ForbiddenError, ValidationError } from "@/lib/errors";
async function observed_GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    return NextResponse.json(await mediaList(actor, restaurant.id));
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(env.APP_URL).origin) throw new ForbiddenError();
    if (!["image/jpeg", "image/png", "image/webp"].includes(req.headers.get("content-type") ?? ""))
      throw new ValidationError("Choose a JPEG, PNG or WebP image");
    const actor = await requestActor(req);
    const { restaurant } = await requestContext(req);
    return NextResponse.json(
      await uploadDishPhoto(
        actor,
        restaurant.id,
        await boundedBytes(req, 5242880),
        decodeURIComponent(req.headers.get("x-media-rights") ?? "")
      ),
      { status: 202 }
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
