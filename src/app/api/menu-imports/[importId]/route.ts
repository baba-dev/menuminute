import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { importDetail } from "@/modules/menu-import/service";
type C = { params: Promise<{ importId: string }> };
export async function GET(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req);
    return NextResponse.json(await importDetail(actor, restaurant.id, (await c.params).importId), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
