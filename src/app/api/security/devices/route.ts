import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/request-context";
import { auth } from "@/lib/auth";
import { env } from "@/lib/config/env";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
import { listDevices, revokeDeviceSessions } from "@/lib/device-sessions";

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke"), sessionId: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("revoke-others") }).strict(),
]);
const responseHeaders = { "cache-control": "private, no-store" };
/** Device recovery must remain accessible to authenticated owners still enrolling MFA.
 * This exception does NOT grant any privileged org/admin step-up.
 */
async function deviceActor(req: Request, mutation = false) {
  if (mutation && (req.headers.get("origin") !== new URL(env.APP_URL).origin ||
    !req.headers.get("content-type")?.startsWith("application/json"))) throw new ForbiddenError();
  const session = await auth();
  if (!session?.user.id || !session.session.id) throw new UnauthorizedError();
  return { userId: session.user.id, sessionId: session.session.id };
}
export async function GET(req: Request) {
  try {
    const actor = await deviceActor(req);
    if (!actor.sessionId) return NextResponse.json({ message: "Session required" }, { status: 401, headers: responseHeaders });
    return NextResponse.json({ devices: await listDevices(actor.userId, actor.sessionId) }, { headers: responseHeaders });
  } catch (err) { return errorResponse(err); }
}
export async function POST(req: Request) {
  try {
    const actor = await deviceActor(req, true); // verified origin, JSON and active session
    if (!actor.sessionId) return NextResponse.json({ message: "Session required" }, { status: 401, headers: responseHeaders });
    const body = command.parse(await req.json());
    const revoked = await revokeDeviceSessions(
      actor.userId, actor.sessionId, body.action === "revoke" ? body.sessionId : "others"
    );
    return NextResponse.json({ revoked }, { headers: responseHeaders });
  } catch (err) { return errorResponse(err); }
}
