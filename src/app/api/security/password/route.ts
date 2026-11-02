import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson } from "@/lib/bounded-input";
import { observedRoute } from "@/lib/observed-route";
import { requestActor, errorResponse } from "@/lib/request-context";
import { authServer } from "@/lib/auth";
import { allowPasswordChangeAttempt } from "@/lib/auth-abuse";
import { recordAuthEvent, alertSecurityEvent } from "@/lib/security-events";

const input = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(8).max(128),
  revokeOtherSessions: z.boolean(),
}).strict();

async function observed_POST(req: Request) {
  try {
    const actor = await requestActor(req, true);
    if (!actor.sessionId)
      return NextResponse.json({ message: "Session required" }, { status: 401 });
    const body = input.parse(await boundedJson(req));
    if (body.currentPassword === body.newPassword)
      return NextResponse.json({ message: "Choose a new password" }, { status: 422 });
    // A cache failure must never leave password guessing unbounded.
    let allowed = false;
    try { allowed = await allowPasswordChangeAttempt(actor.userId, actor.sessionId); }
    catch { return NextResponse.json({ message: "Temporarily unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } }); }
    if (!allowed)
      return NextResponse.json({ message: "Too many attempts" },
        { status: 429, headers: { "retry-after": "600", "cache-control": "no-store" } });
    try {
      await authServer.api.changePassword({
        body: { currentPassword: body.currentPassword, newPassword: body.newPassword,
          revokeOtherSessions: body.revokeOtherSessions },
        headers: req.headers,
      });
    } catch {
      // Do not distinguish wrong passwords from credential errors.
      return NextResponse.json({ message: "Could not verify the current password" },
        { status: 400, headers: { "cache-control": "no-store" } });
    }
    // Notifications are best-effort; the password change itself is authoritative.
    await recordAuthEvent(actor.userId, "password.changed", actor.sessionId).catch(() => {});
    void alertSecurityEvent(actor.userId, "Your MenuMinute password was changed");
    return NextResponse.json({ changed: true }, { headers: { "cache-control": "no-store" } });
  } catch (error) { return errorResponse(error, req); }
}
export const POST = observedRoute(observed_POST);
