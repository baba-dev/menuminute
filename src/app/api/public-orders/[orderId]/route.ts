import { NextResponse } from "next/server";
import { z } from "zod";
import { getGuestOrderTracking } from "@/modules/orders/service";
import { errorResponse } from "@/lib/request-context";
import { UnauthorizedError } from "@/lib/errors";
import {
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";

const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const noStore = { "cache-control": "no-store" };

export async function GET(req: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    // Even malformed tracking requests consume a bounded source allowance.
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveOrderSource("tracking", source))) {
        return NextResponse.json(
          { message: "Tracking limit reached" },
          { status: 429, headers: noStore }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Tracking temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }

    const { orderId } = await context.params;
    const url = new URL(req.url);
    const token = tokenSchema.parse(url.searchParams.get("token"));
    const trackingToken =
      req.headers.get("x-tracking-token") || url.searchParams.get("trackingToken");
    if (!trackingToken || trackingToken.length > 128) {
      throw new UnauthorizedError("Tracking token required");
    }
    try {
      if (!(await reserveOrderCapability("tracking", source, token))) {
        return NextResponse.json(
          { message: "Tracking limit reached" },
          { status: 429, headers: noStore }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Tracking temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }
    const data = await getGuestOrderTracking(token, orderId, trackingToken);
    return NextResponse.json(data, { status: 200, headers: noStore });
  } catch (err) {
    return errorResponse(err, req);
  }
}
