import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/modules/intelligence/request";
import {
  conversationInput,
  createConversation,
  listConversations,
} from "@/modules/intelligence/store";
import { env } from "@/lib/config/env";
import { enforceDemoEmber } from "@/modules/demo/ember-limit";
const scopeSchema = conversationInput.omit({ key: true });
async function observed_GET(req: Request) {
  try {
    const actor = await requestActor(req);
    const params = Object.fromEntries(new URL(req.url).searchParams.entries());
    const input = scopeSchema.parse(params);
    return NextResponse.json(await listConversations({ ...input, actor }), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
async function observed_POST(req: Request) {
  try {
    const actor = await requestActor(req, true);
    if (!env.AI_ASSISTANT_READ_ONLY_ENABLED)
      return NextResponse.json(
        { message: "Ember is not enabled" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    const input = conversationInput.parse(await boundedJson(req));
    await enforceDemoEmber(req, actor.userId, "conversation");
    const data = await createConversation(
      { actor, organizationId: input.organizationId, outletId: input.outletId },
      input.key
    );
    return NextResponse.json(data, {
      status: 201,
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
