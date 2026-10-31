import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/request-context";
import { routeOutlet } from "@/modules/dashboard/route-outlet";
import { paletteIndex } from "@/modules/dashboard/shell-data";

const privateHeaders = { "cache-control": "private, no-store", vary: "Cookie" };

/** Search index for the command palette: names, numbers and states only, fetched once per open. */
async function observed_GET(req: Request) {
  try {
    const { actor, outlet } = await routeOutlet(req);
    return NextResponse.json(await paletteIndex(actor, outlet.organizationId, outlet.id), {
      headers: privateHeaders,
    });
  } catch (error) {
    const response = errorResponse(error, req);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  }
}

export const GET = observedRoute(observed_GET);
