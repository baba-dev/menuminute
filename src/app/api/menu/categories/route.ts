import { NextRequest, NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import {
  getCategoriesByRestaurant,
  createCategory,
  createCategorySchema,
} from "@/modules/menus/service";

export async function GET(req: NextRequest) {
  try {
    const { actor, restaurant } = await requestContext(req, req.method !== "GET");

    const categories = await getCategoriesByRestaurant(actor, restaurant.id);
    return NextResponse.json(categories);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { actor, restaurant } = await requestContext(req, req.method !== "GET");

    const body = (await req.json()) as unknown;
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", fields: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const category = await createCategory(actor, restaurant.id, parsed.data);
    return NextResponse.json(category, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
