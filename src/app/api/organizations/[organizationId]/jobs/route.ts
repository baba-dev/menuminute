import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { retryEvent } from "@/modules/organizations/service";
async function observed_POST(
  req: Request,
  context: { params: Promise<{ organizationId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    const body = z
      .object({ eventId: z.uuid() })
      .strict()
      .parse(await boundedJson(req));
    await retryEvent(actor, (await context.params).organizationId, body.eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
