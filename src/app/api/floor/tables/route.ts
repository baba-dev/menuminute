import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { createFloorTable, deleteTable } from "@/modules/hospitality/floor-service";
import { visualTableSchema, floorLayoutDocSchema } from "@/modules/hospitality/floor-contracts";
import { z } from "zod";

async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await req.json();
    const parsed = z.object({ table: visualTableSchema, layout: floorLayoutDocSchema }).strict().parse(body);
    const result = await createFloorTable(actor, restaurant.id, parsed.table, parsed.layout);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, req);
  }
}

async function observed_DELETE(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await req.json();
    const { tableId, layout } = z.object({ tableId: z.string().min(1), layout: floorLayoutDocSchema }).strict().parse(body);
    const updated = await deleteTable(actor, restaurant.id, tableId, layout);
    return NextResponse.json(updated);
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
export const DELETE = observedRoute(observed_DELETE);
