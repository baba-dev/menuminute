import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import {
  createMenuItem,
  createMenuItemSchema,
  getCategoriesByRestaurant,
  getMenuItemsByCategory,
} from "@/modules/menus/service";
import { serializeError } from "@/lib/errors";

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const restaurant = getDefaultOrActiveRestaurant(session?.user?.id);

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    if (categoryId) {
      const items = getMenuItemsByCategory(categoryId, restaurant.id);
      return NextResponse.json(items);
    }

    // Return all items grouped
    const categories = getCategoriesByRestaurant(restaurant.id);
    const allItems = categories.flatMap((cat) => getMenuItemsByCategory(cat.id, restaurant.id));

    return NextResponse.json(allItems);
  } catch (err) {
    return NextResponse.json(serializeError(err), { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const restaurant = getDefaultOrActiveRestaurant(session?.user?.id);

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const body = (await req.json()) as unknown;
    const parsed = createMenuItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", fields: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const item = createMenuItem(restaurant.id, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return NextResponse.json(serializeError(err), { status: 500 });
  }
}
