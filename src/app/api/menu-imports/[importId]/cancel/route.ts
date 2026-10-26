import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/lib/bounded-input";
import { cancelImport } from "@/modules/menu-import/service";
type C = { params: Promise<{ importId: string }> };
export async function POST(req: Request, c: C) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    return NextResponse.json(
      await cancelImport(actor, restaurant.id, (await c.params).importId, await boundedJson(req)),
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}
