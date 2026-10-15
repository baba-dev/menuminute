import { NextRequest, NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import {
  createMenuItem,
  createMenuItemSchema,
  getCategoriesByRestaurant,
  getMenuItemsByCategory,
} from "@/modules/menus/service";

export async function GET(req: NextRequest) {
  try {
    const { actor, restaurant } = await requestContext(req, req.method !== "GET");

    const { searchParams } = new URL(req.url);
    const categoryId = searchParams.get("categoryId");

    if (categoryId) {
      const items = await getMenuItemsByCategory(actor, categoryId, restaurant.id);
      return NextResponse.json(items);
    }

    // Return all items grouped
    const categories = await getCategoriesByRestaurant(actor, restaurant.id);
    const allItems = (
      await Promise.all(
        categories.map((cat) => getMenuItemsByCategory(actor, cat.id, restaurant.id))
      )
    ).flat();

    return NextResponse.json(allItems);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { actor, restaurant } = await requestContext(req, req.method !== "GET");

    const body = (await req.json()) as unknown;
    const parsed = createMenuItemSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", fields: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const item = await createMenuItem(actor, restaurant.id, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
