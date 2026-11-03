import { NextResponse } from "next/server";
import { observedRoute } from "@/lib/observed-route";
import { requestActor, errorResponse } from "@/lib/request-context";
import { posTaxPolicy } from "@/modules/pos/service";

type Context = { params: Promise<{ organizationId: string; outletId: string }> };

/** Read-only checkout quote for authorized POS staff. No merchant configuration rights needed. */
async function observed_GET(req: Request, { params }: Context) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    return NextResponse.json(await posTaxPolicy(actor, organizationId, outletId), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
export const GET = observedRoute(observed_GET);
