import { createHash } from "node:crypto";
import { z } from "zod";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { listMenus, defaultDocument, commandMenu } from "@/modules/menu-product/service";
import { boundedJson } from "@/lib/bounded-input";
export async function GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    return NextResponse.json(await listMenus(actor, restaurant.id));
  } catch (e) {
    return errorResponse(e, req);
  }
}
export async function POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await boundedJson(req);
    const key = z.uuid().parse(body.key);
    const id = createHash("sha256").update(`${actor.userId}:${restaurant.id}:${key}`).digest("hex");
    const doc = await defaultDocument(actor, restaurant.id);
    const result = await commandMenu(actor, restaurant.id, id, {
      key: body.key,
      expectedRevision: 0,
      action: "create",
      data: { document: doc },
    });
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    return errorResponse(e, req);
  }
}
