import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { confirmStepUp } from "@/lib/step-up";
import { allowStepUpAttempt } from "@/lib/auth-abuse";
export async function POST(req: Request) {
  try {
    const actor = await requestActor(req, true);
    const body = z
      .object({ password: z.string().min(1).max(128), code: z.string().regex(/^\d{6}$/) })
      .strict()
      .parse(await req.json());
    if (!actor.sessionId)
      return NextResponse.json({ message: "Authentication failed" }, { status: 401 });
    // Check throttle before evaluating either credential. A Redis outage is fail-closed.
    let allowed = false;
    try {
      allowed = await allowStepUpAttempt(actor.userId, actor.sessionId);
    } catch {
      return NextResponse.json(
        { message: "Authentication temporarily unavailable" },
        {
          status: 503,
          headers: { "cache-control": "no-store" },
        }
      );
    }
    if (!allowed)
      return NextResponse.json(
        { message: "Too many attempts" },
        {
          status: 429,
          headers: { "cache-control": "no-store", "retry-after": "600" },
        }
      );
    if (
      !(await confirmStepUp(actor.userId, actor.sessionId, body.password, body.code, req.headers))
    )
      return NextResponse.json(
        { message: "Authentication failed" },
        { status: 401, headers: { "cache-control": "no-store" } }
      );
    return NextResponse.json({ confirmed: true }, { headers: { "cache-control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
