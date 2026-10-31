import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { createOrUpdateTable, deleteTable } from "@/modules/hospitality/floor-service";
import { visualTableSchema } from "@/modules/hospitality/floor-contracts";
import { z } from "zod";

async function observed_POST(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await req.json();
    const tableData = visualTableSchema.parse(body);
    const result = await createOrUpdateTable(actor, restaurant.id, tableData);
    return NextResponse.json(result);
  } catch (e) {
    return errorResponse(e, req);
  }
}

async function observed_DELETE(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req, true);
    const body = await req.json();
    const { tableId } = z.object({ tableId: z.string().min(1) }).parse(body);
    await deleteTable(actor, restaurant.id, tableId);
    return NextResponse.json({ success: true, tableId });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
export const DELETE = observedRoute(observed_DELETE);
