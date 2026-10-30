import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { financeCommand, financeRead } from "@/modules/pos/finance";

type Params = { params: Promise<{ organizationId: string; outletId: string }> };
async function observed_GET(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    const url = new URL(req.url);
    const view = url.searchParams.get("view");
    const id = url.searchParams.get("id");
    const cursorAt = url.searchParams.get("cursorAt");
    const cursorId = url.searchParams.get("cursorId");
    const cursorView = view === "reconcile_page" || view === "ledger_page";
    const data = await financeRead(actor, organizationId, outletId,
      cursorView
        ? { view, ...(cursorAt ? { cursorAt } : {}), ...(cursorId ? { cursorId } : {}) }
        : id ? { view, id } : { view });
    return NextResponse.json(data, {
      headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
async function observed_POST(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const data = await financeCommand(actor, organizationId, outletId, await req.json());
    return NextResponse.json(data, {
      headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex, nofollow" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
