import { NextResponse } from "next/server";
import { z } from "zod";
import { requestContext, errorResponse } from "@/lib/request-context";
import { listReusableDishes } from "@/modules/menu-product/service";
import { entityId } from "@/modules/menu-product/contracts";

export async function GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    const url = new URL(req.url);
    const menuId = entityId.parse(z.string().parse(url.searchParams.get("menuId")));
    return NextResponse.json(
      { items: await listReusableDishes(actor, restaurant.id, menuId) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
