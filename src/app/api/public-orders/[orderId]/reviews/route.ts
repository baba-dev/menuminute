import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/request-context";
import { boundedBytes } from "@/lib/bounded-input";
import { UnauthorizedError } from "@/lib/errors";
import { guestReviewState, submitGuestReview } from "@/modules/reviews/service";
import { admitReviewRequest } from "@/modules/reviews/guard";

type Params = { params: Promise<{ orderId: string }> };
const headers = { "cache-control": "no-store" };
const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

async function observed_GET(req: Request, { params }: Params) {
  try {
    const token = tokenSchema.parse(new URL(req.url).searchParams.get("token"));
    const denied = await admitReviewRequest(req, token, { write: false });
    if (denied) return denied;
    const tracking = req.headers.get("x-tracking-token");
    if (!tracking) throw new UnauthorizedError("Tracking token required");
    const { orderId } = await params;
    return NextResponse.json(await guestReviewState(token, orderId, tracking), { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_POST(req: Request, { params }: Params) {
  try {
    const body = JSON.parse((await boundedBytes(req, 4096)).toString("utf8"));
    const denied = await admitReviewRequest(req, tokenSchema.parse(body?.token), { write: true });
    if (denied) return denied;
    const { orderId } = await params;
    return NextResponse.json(await submitGuestReview(orderId, body), { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
