import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { errorResponse, requestActor } from "@/lib/request-context";
import { availableOutletTimezones } from "@/modules/timezones/service";

async function observed_GET(request: Request) {
  try {
    await requestActor(request);
    const options = await availableOutletTimezones();
    return NextResponse.json(
      { options },
      { headers: { "cache-control": "private, no-store", vary: "Cookie" } }
    );
  } catch (error) {
    return errorResponse(error, request);
  }
}

export const GET = observedRoute(observed_GET);
