import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/modules/intelligence/request";
import {
  readDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
} from "@/modules/dashboard/layout-preference";

const headers = { "cache-control": "private, no-store", vary: "Cookie" };

async function observed_GET(req: Request) {
  try {
    const actor = await requestActor(req);
    return NextResponse.json({ layout: await readDashboardLayout(actor.userId) }, { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_PUT(req: Request) {
  try {
    const actor = await requestActor(req, true);
    const layout = await saveDashboardLayout(actor, await boundedJson(req));
    return NextResponse.json({ layout }, { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_DELETE(req: Request) {
  try {
    const actor = await requestActor(req, true);
    return NextResponse.json({ layout: await resetDashboardLayout(actor) }, { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
export const PUT = observedRoute(observed_PUT);
export const DELETE = observedRoute(observed_DELETE);
