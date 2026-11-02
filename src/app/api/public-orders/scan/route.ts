import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/request-context";
import { boundedBytes } from "@/lib/bounded-input";
import { env } from "@/lib/config/env";
import { recordQrScan } from "@/modules/hospitality/service";
import {
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";

const BODY_LIMIT = 1024;
const headers = { "cache-control": "no-store" };

/** Fire-and-forget scan beacon from the public menu. Always answers 204 on a handled request. */
async function observed_POST(req: Request) {
  try {
    if (req.headers.get("origin") !== new URL(env.APP_URL).origin) {
      return NextResponse.json({ message: "Invalid request origin" }, { status: 403, headers });
    }
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveOrderSource("tracking", source))) {
        return new NextResponse(null, { status: 429, headers });
      }
    } catch {
      return new NextResponse(null, { status: 503, headers });
    }
    const body = JSON.parse((await boundedBytes(req, BODY_LIMIT)).toString("utf8")) as {
      token?: unknown;
    };
    try {
      if (
        typeof body.token === "string" &&
        !(await reserveOrderCapability("tracking", source, body.token))
      ) {
        return new NextResponse(null, { status: 429, headers });
      }
    } catch {
      return new NextResponse(null, { status: 503, headers });
    }
    await recordQrScan(body);
    return new NextResponse(null, { status: 204, headers });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
