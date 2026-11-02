import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/request-context";
import { publicDishReviews } from "@/modules/reviews/service";
import { admitReviewRequest } from "@/modules/reviews/guard";

type Params = { params: Promise<{ token: string }> };
const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

async function observed_GET(req: Request, { params }: Params) {
  try {
    const token = tokenSchema.parse((await params).token);
    const denied = await admitReviewRequest(req, token, { write: false });
    if (denied) return denied;
    const dish = new URL(req.url).searchParams.get("dish") ?? "";
    return NextResponse.json(await publicDishReviews(token, dish), {
      headers: { "cache-control": "public, max-age=30, s-maxage=30" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
