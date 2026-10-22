import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { historyQuerySchema, listServiceHistory, listServiceRail, servicePulse } from "@/modules/orders/workspace";
export async function GET(req: Request, context: { params: Promise<{ organizationId: string; outletId: string }> }) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await context.params;
    const url = new URL(req.url);
    const view = z.enum(["rail", "pulse", "history"]).parse(url.searchParams.get("view"));
    let data: unknown;
    if (view === "rail") data = await listServiceRail(actor, organizationId, outletId);
    else if (view === "pulse") data = await servicePulse(actor, organizationId, outletId);
    else {
      const params = Object.fromEntries(url.searchParams.entries());
      delete params.view;
      data = await listServiceHistory(actor, organizationId, outletId, historyQuerySchema.parse(params));
    }
    return NextResponse.json(data, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
