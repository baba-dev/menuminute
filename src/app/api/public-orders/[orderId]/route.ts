import { NextResponse } from "next/server";
import { z } from "zod";
import { getGuestOrderTracking } from "@/modules/orders/service";
import { errorResponse } from "@/lib/request-context";
import { UnauthorizedError } from "@/lib/errors";

export async function GET(
  req: Request,
  context: { params: Promise<{ orderId: string }> }
) {
  try {
    const { orderId } = await context.params;
    const url = new URL(req.url);

    const token = z.string().min(1).max(128).parse(url.searchParams.get("token"));
    const trackingToken =
      url.searchParams.get("trackingToken") || req.headers.get("x-tracking-token");

    if (!trackingToken) {
      throw new UnauthorizedError("Tracking token required");
    }

    const data = await getGuestOrderTracking(token, orderId, trackingToken);

    return NextResponse.json(data, {
      status: 200,
      headers: { "cache-control": "no-store" },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
