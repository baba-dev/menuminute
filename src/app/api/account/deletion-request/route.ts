import { NextResponse } from "next/server";
import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { requestActor, errorResponse } from "@/lib/request-context";
import {
  cancelAccountDeletion,
  getAccountDeletionRequest,
  requestAccountDeletion,
} from "@/modules/support/account-deletion";

async function observed_GET(req: Request) {
  try {
    return NextResponse.json(await getAccountDeletionRequest(await requestActor(req)), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
async function observed_POST(req: Request) {
  try {
    const actor = await requestActor(req, true);
    const result = await requestAccountDeletion(actor, await boundedJson(req));
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}
async function observed_DELETE(req: Request) {
  try {
    const actor = await requestActor(req, true);
    const body = await boundedJson(req);
    if (!body || typeof body !== "object" || Array.isArray(body) || !("confirm" in body) || body.confirm !== true || Object.keys(body).length !== 1) {
      return NextResponse.json({ message: "Confirm cancellation first." }, { status: 422 });
    }
    const result = await cancelAccountDeletion(actor);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}
export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
export const DELETE = observedRoute(observed_DELETE);
