import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { staffReviewAction, staffReviewQueue } from "@/modules/reviews/service";

type Params = { params: Promise<{ organizationId: string; outletId: string }> };
const headers = { "cache-control": "private, no-store" };

async function observed_GET(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    return NextResponse.json(await staffReviewQueue(actor, organizationId, outletId), { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}
async function observed_POST(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    return NextResponse.json(
      await staffReviewAction(actor, organizationId, outletId, await boundedJson(req)),
      { headers }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
