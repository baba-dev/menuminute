import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { recordOrdersReadFailure } from "@/modules/orders/diagnostics";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import {
  historyQuerySchema,
  listServiceHistory,
  listServiceRail,
  servicePulse,
} from "@/modules/orders/workspace";
export async function GET(
  req: Request,
  context: { params: Promise<{ organizationId: string; outletId: string }> }
) {
  const requestId = randomUUID();
  let viewName = "unknown";
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await context.params;
    const url = new URL(req.url);
    const view = z.enum(["rail", "pulse", "history"]).parse(url.searchParams.get("view"));
    viewName = view;
    let data: unknown;
    if (view === "rail") data = await listServiceRail(actor, organizationId, outletId);
    else if (view === "pulse") data = await servicePulse(actor, organizationId, outletId);
    else {
      const params = Object.fromEntries(url.searchParams.entries());
      delete params.view;
      data = await listServiceHistory(
        actor,
        organizationId,
        outletId,
        historyQuerySchema.parse(params)
      );
    }
    return NextResponse.json(data, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    recordOrdersReadFailure(viewName, requestId, error);
    const response = errorResponse(error);
    response.headers.set("cache-control", "private, no-store");
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
