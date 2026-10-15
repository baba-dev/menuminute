import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { retryEvent } from "@/modules/organizations/service";
export async function POST(req: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    const actor = await requestActor(req, true);
    const body = z
      .object({ eventId: z.uuid() })
      .strict()
      .parse(await req.json());
    await retryEvent(actor, (await context.params).organizationId, body.eventId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
