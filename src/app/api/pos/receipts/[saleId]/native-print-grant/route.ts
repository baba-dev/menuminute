import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { boundedBytes } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { errorResponse, requestActor } from "@/lib/request-context";
import { UnauthorizedError, ValidationError } from "@/lib/errors";
import { issueNativePrintGrant } from "@/modules/pos/native-print";

const body = z.object({ paper: z.enum(["58", "80"]) }).strict();

// Thin handler: authorization (live membership, outlet scope, fiscal-document guard) is in the service.
async function observed_POST(req: Request, ctx: { params: Promise<{ saleId: string }> }) {
  try {
    const actor = await requestActor(req, true);
    const session = await auth();
    if (!session?.user.id) throw new UnauthorizedError();
    let raw: unknown = null;
    try {
      raw = JSON.parse((await boundedBytes(req, 256)).toString("utf8"));
    } catch {
      raw = null;
    }
    const parsed = body.safeParse(raw);
    if (!parsed.success) throw new ValidationError("Choose a 58 mm or 80 mm paper width");
    const { saleId } = await ctx.params;
    const grant = await issueNativePrintGrant(
      { userId: actor.userId, sessionId: actor.sessionId },
      session.activeOutletId ?? undefined,
      saleId,
      parsed.data.paper
    );
    return NextResponse.json(grant, { headers: { "Cache-Control": "private, no-store" } });
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
