import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/request-context";
import { tableServiceState } from "@/modules/hospitality/service";
import { guestEdgeGuard } from "@/modules/orders/public-guard";

const headers = { "cache-control": "no-store" };

/** Public: whether the guest water button is on for this table QR, and the latest request state. */
async function observed_GET(req: Request) {
  try {
    const token = new URL(req.url).searchParams.get("token");
    const refused = await guestEdgeGuard(req, token, { mutation: false });
    if (refused) return refused;
    return NextResponse.json(await tableServiceState({ token }), { headers });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
