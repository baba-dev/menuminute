import { NextResponse } from "next/server";
import { boundedJson } from "@/lib/bounded-input";
import { errorResponse, requestContext } from "@/lib/request-context";
import { listMenuTranslations, saveMenuTranslation } from "@/modules/menu-product/service";

type Context = { params: Promise<{ menuId: string }> };

export async function GET(req: Request, context: Context) {
  try {
    const { actor } = await requestContext(req);
    return NextResponse.json(await listMenuTranslations(actor, (await context.params).menuId), {
      headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export async function PUT(req: Request, context: Context) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(
      await saveMenuTranslation(
        actor,
        restaurant.id,
        (await context.params).menuId,
        await boundedJson(req)
      ),
      { headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" } }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}
