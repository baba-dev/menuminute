import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { env } from "@/lib/config/env";
import { boundedJson } from "@/modules/intelligence/request";
import { createProviderHub } from "@/modules/intelligence";
import { beginTurn, conversationInput, turnInput } from "@/modules/intelligence/store";
import { runReadOnlyTurn } from "@/modules/intelligence/orchestrator";
const schema = conversationInput.omit({ key: true }).extend(turnInput.shape).strict();
async function observed_POST(req: Request, context: { params: Promise<{ conversationId: string }> }) {
  try {
    const actor = await requestActor(req, true);
    if (!env.AI_ASSISTANT_READ_ONLY_ENABLED)
      return NextResponse.json(
        { message: "Ember is not enabled" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    const hub = createProviderHub(env);
    if (!hub.available().some((provider) => provider.supportsTools))
      return NextResponse.json(
        { message: "No verified read-only AI model configured" },
        { status: 503, headers: { "cache-control": "no-store" } }
      );
    const input = schema.parse(await boundedJson(req));
    const { conversationId } = await context.params;
    const scope = { actor, organizationId: input.organizationId, outletId: input.outletId };
    const start = await beginTurn(scope, conversationId, { key: input.key, prompt: input.prompt });
    if (!start.created)
      return NextResponse.json(
        {
          turnId: start.turn.id,
          status: start.turn.status,
          answer: start.turn.answer,
          evidence: start.turn.evidence,
          errorCode: start.turn.errorCode,
        },
        {
          status: start.turn.status === "processing" ? 202 : 200,
          headers: { "cache-control": "private, no-store" },
        }
      );
    const result = await runReadOnlyTurn(scope, start.turn, hub);
    return NextResponse.json(result, {
      status: result.status === "failed" ? 503 : 200,
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const POST = observedRoute(observed_POST);
