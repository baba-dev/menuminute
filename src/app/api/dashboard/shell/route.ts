import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/request-context";
import { routeOutlet } from "@/modules/dashboard/route-outlet";
import { shellSnapshot } from "@/modules/dashboard/shell-data";

const privateHeaders = { "cache-control": "private, no-store", vary: "Cookie" };

/** One permission-checked poll for the topbar, notifications and connection state. */
async function observed_GET(req: Request) {
  try {
    const { actor, outlet } = await routeOutlet(req);
    const snapshot = await shellSnapshot(
      actor,
      outlet.organizationId,
      outlet.id,
      outlet.currency ?? "INR"
    );
    return NextResponse.json(snapshot, { headers: privateHeaders });
  } catch (error) {
    const response = errorResponse(error, req);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  }
}

export const GET = observedRoute(observed_GET);
