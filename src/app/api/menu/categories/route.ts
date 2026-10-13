import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import {
  getCategoriesByRestaurant,
  createCategory,
  createCategorySchema,
} from "@/modules/menus/service";
import { serializeError } from "@/lib/errors";

export async function GET() {
  try {
    const session = await auth();
    const restaurant = getDefaultOrActiveRestaurant(session?.user?.id);

    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const categories = getCategoriesByRestaurant(restaurant.id);
    return NextResponse.json(categories);
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
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", fields: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const category = createCategory(restaurant.id, parsed.data);
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return NextResponse.json(serializeError(err), { status: 500 });
  }
}
