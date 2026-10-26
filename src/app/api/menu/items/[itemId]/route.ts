import { NextRequest, NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { updateMenuItem, deleteMenuItem, updateMenuItemSchema } from "@/modules/menus/service";

interface RouteParams {
  params: Promise<{
    itemId: string;
  }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params;
    const { actor, restaurant } = await requestContext(req, req.method !== "GET");

    const body = (await req.json()) as unknown;
    const parsed = updateMenuItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", fields: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updated = await updateMenuItem(actor, itemId, restaurant.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    return errorResponse(err, req);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params;
    const { actor, restaurant } = await requestContext(req, req.method !== "GET");

    await deleteMenuItem(actor, itemId, restaurant.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return errorResponse(err, req);
  }
}
