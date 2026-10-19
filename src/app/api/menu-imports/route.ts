import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/lib/bounded-input";
import { createImport, listImports } from "@/modules/menu-import/service";
export async function GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    return NextResponse.json(await listImports(actor, restaurant.id), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
export async function POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const result = await createImport(actor, restaurant.id, await boundedJson(req));
    return NextResponse.json(result, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
