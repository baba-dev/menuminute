import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { requestActor, errorResponse } from "@/lib/request-context";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { dashboardPulseSnapshot } from "@/modules/menu-product/dashboard-optional-pulse";

const privateHeaders = { "cache-control": "private, no-store", vary: "Cookie" };

/** Never accept client-supplied organization/outlet scopes: resolve them from the authenticated session. */
async function observed_GET(req: Request) {
  const started = Date.now();
  try {
    const actor = await requestActor(req);
    const outlet = await getDefaultOrActiveRestaurant(
      actor.userId,
      (await cookies()).get("menuminute.outlet")?.value
    );
    if (!outlet) {
      return NextResponse.json(
        { message: "Select an outlet before viewing service activity" },
        { status: 404, headers: privateHeaders }
      );
    }
    const snapshot = await dashboardPulseSnapshot(actor, outlet.organizationId, outlet.id);
    if (snapshot.state === "unavailable") {
      console.warn("[dashboard] Service pulse degraded", {
        area: "overview",
        latencyMs: Date.now() - started,
      });
    }
    return NextResponse.json({ outletId: outlet.id, ...snapshot }, { headers: privateHeaders });
  } catch (error) {
    const response = errorResponse(error, req);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  }
}

export const GET = observedRoute(observed_GET);
