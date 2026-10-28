import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { requestActor, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/modules/intelligence/request";
import { proposalInput, proposeAvailability } from "@/modules/intelligence/actions";
async function observed_POST(req: Request) {
  try {
    const actor = await requestActor(req, true);
    if (!env.AI_ASSISTANT_ACTIONS_ENABLED || !env.AI_ASSISTANT_READ_ONLY_ENABLED)
      return NextResponse.json({ message: "Assistant actions are disabled" }, { status: 503 });
    const p = proposalInput.parse(await boundedJson(req));
    const result = await proposeAvailability(
      { actor, organizationId: p.organizationId, outletId: p.outletId },
      p
    );
    return NextResponse.json(result, {
      status: 201,
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const POST = observedRoute(observed_POST);
