import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { updateMenuItem, deleteMenuItem, updateMenuItemSchema } from "@/modules/menus/service";
import { serializeError } from "@/lib/errors";

interface RouteParams {
  params: Promise<{
    itemId: string;
  }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params;
    const session = await auth();
    const restaurant = getDefaultOrActiveRestaurant(session?.user?.id);

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const body = (await req.json()) as unknown;
    const parsed = updateMenuItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", fields: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const updated = updateMenuItem(itemId, restaurant.id, parsed.data);
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(serializeError(err), { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const { itemId } = await params;
    const session = await auth();
    const restaurant = getDefaultOrActiveRestaurant(session?.user?.id);

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    deleteMenuItem(itemId, restaurant.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(serializeError(err), { status: 500 });
  }
}
