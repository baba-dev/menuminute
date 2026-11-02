import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/request-context";
import { boundedBytes } from "@/lib/bounded-input";
import { requestTableWater } from "@/modules/hospitality/service";
import { guestEdgeGuard } from "@/modules/orders/public-guard";

const headers = { "cache-control": "no-store" };

/** Public: the guest taps "Request water" on a table QR menu. */
async function observed_POST(req: Request) {
  try {
    const body = JSON.parse((await boundedBytes(req, 1024)).toString("utf8")) as {
      token?: unknown;
    };
    const refused = await guestEdgeGuard(req, typeof body.token === "string" ? body.token : null, {
      mutation: true,
    });
    if (refused) return refused;
    return NextResponse.json(await requestTableWater(body), { headers });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
