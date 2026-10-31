import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { requestActor, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/modules/intelligence/request";
import { conversationInput } from "@/modules/intelligence/store";
import { decideAction, decideActionInput } from "@/modules/intelligence/action-requests";
type Context = { params: Promise<{ requestId: string }> };
const body = conversationInput.omit({ key: true }).extend(decideActionInput.shape).strict();
async function observed_POST(req: Request, c: Context) {
  try {
    const actor = await requestActor(req, true);
    if (!env.AI_ASSISTANT_ACTIONS_ENABLED || !env.AI_ASSISTANT_READ_ONLY_ENABLED)
      return NextResponse.json({ message: "Assistant actions are disabled" }, { status: 503 });
    const { organizationId, outletId, key, decision } = body.parse(await boundedJson(req));
    const result = await decideAction(
      { actor, organizationId, outletId },
      z
        .string()
        .uuid()
        .parse((await c.params).requestId),
      { key, decision }
    );
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const POST = observedRoute(observed_POST);
