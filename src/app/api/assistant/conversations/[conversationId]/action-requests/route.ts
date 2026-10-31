import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { requestActor, errorResponse } from "@/lib/request-context";
import { conversationInput } from "@/modules/intelligence/store";
import { actionRequestHistory } from "@/modules/intelligence/action-requests";
type Context = { params: Promise<{ conversationId: string }> };
async function observed_GET(req: Request, c: Context) {
  try {
    const actor = await requestActor(req);
    if (!env.AI_ASSISTANT_ACTIONS_ENABLED || !env.AI_ASSISTANT_READ_ONLY_ENABLED)
      return NextResponse.json([], { headers: { "cache-control": "private, no-store" } });
    const scope = conversationInput
      .omit({ key: true })
      .parse(Object.fromEntries(new URL(req.url).searchParams));
    return NextResponse.json(
      await actionRequestHistory({ ...scope, actor }, (await c.params).conversationId),
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
