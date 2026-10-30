import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/request-context";
import { boundedBytes } from "@/lib/bounded-input";
import { env } from "@/lib/config/env";
import {
  callGuestService,
  guestServiceState,
  serviceSignalSchema,
} from "@/modules/hospitality/service";
import {
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";
type Params = { params: Promise<{ orderId: string }> };
const BODY_LIMIT = 4096;
const headers = { "cache-control": "no-store" };
async function observed_POST(req: Request, { params }: Params) {
  try {
    if (req.headers.get("origin") !== new URL(env.APP_URL).origin) {
      return NextResponse.json({ message: "Invalid request origin" }, { status: 403, headers });
    }
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveOrderSource("tracking", source))) {
        return NextResponse.json(
          { message: "Service request limit reached" },
          { status: 429, headers }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Service requests temporarily unavailable" },
        { status: 503, headers }
      );
    }
    const body = serviceSignalSchema.parse(
      JSON.parse((await boundedBytes(req, BODY_LIMIT)).toString("utf8"))
    );
    try {
      if (!(await reserveOrderCapability("tracking", source, body.token))) {
        return NextResponse.json(
          { message: "Service request limit reached" },
          { status: 429, headers }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Service requests temporarily unavailable" },
        { status: 503, headers }
      );
    }
    const { orderId } = await params;
    const result = await callGuestService(orderId, body);
    return NextResponse.json(result, { headers });
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_GET(req: Request, { params }: Params) {
  try {
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveOrderSource("tracking", source))) {
        return NextResponse.json(
          { message: "Service request limit reached" },
          { status: 429, headers }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Service requests temporarily unavailable" },
        { status: 503, headers }
      );
    }
    const { orderId } = await params;
    const url = new URL(req.url);
    const query = serviceSignalSchema.pick({ token: true, trackingToken: true }).parse({
      token: url.searchParams.get("token"),
      trackingToken: req.headers.get("x-tracking-token"),
    });
    try {
      if (!(await reserveOrderCapability("tracking", source, query.token))) {
        return NextResponse.json(
          { message: "Service request limit reached" },
          { status: 429, headers }
        );
      }
    } catch {
      return NextResponse.json(
        { message: "Service requests temporarily unavailable" },
        { status: 503, headers }
      );
    }
    return NextResponse.json(await guestServiceState(orderId, query.token, query.trackingToken), {
      headers,
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
export const GET = observedRoute(observed_GET);
