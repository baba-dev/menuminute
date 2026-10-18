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
      req.headers.get("x-tracking-token") || url.searchParams.get("trackingToken");

    if (!trackingToken || trackingToken.length > 128) {
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
