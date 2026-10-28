import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/request-context";
import { callGuestService, guestServiceState } from "@/modules/hospitality/service";
type Params = { params: Promise<{ orderId: string }> };
const headers = { "cache-control": "no-store" };
async function observed_POST(req: Request, { params }: Params) {
  try {
    const { orderId } = await params;
    const result = await callGuestService(orderId, await req.json());
    return NextResponse.json(result, { headers });
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_GET(req: Request, { params }: Params) {
  try {
    const { orderId } = await params;
    const url = new URL(req.url);
    const query = z.object({ token: z.string(), trackingToken: z.string() }).parse({
      token: url.searchParams.get("token"),
      trackingToken: req.headers.get("x-tracking-token"),
    });
    return NextResponse.json(await guestServiceState(orderId, query.token, query.trackingToken), {
      headers,
    });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
export const GET = observedRoute(observed_GET);
