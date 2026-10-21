import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { listDevices, revokeDeviceSessions } from "@/lib/device-sessions";

const command = z.discriminatedUnion("action", [
  z.object({ action: z.literal("revoke"), sessionId: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("revoke-others") }).strict(),
]);
const responseHeaders = { "cache-control": "private, no-store" };
export async function GET(req: Request) {
  try {
    const actor = await requestActor(req);
    if (!actor.sessionId) return NextResponse.json({ message: "Session required" }, { status: 401, headers: responseHeaders });
    return NextResponse.json({ devices: await listDevices(actor.userId, actor.sessionId) }, { headers: responseHeaders });
  } catch (err) { return errorResponse(err); }
}
export async function POST(req: Request) {
  try {
    const actor = await requestActor(req, true); // verified origin, JSON and active session
    if (!actor.sessionId) return NextResponse.json({ message: "Session required" }, { status: 401, headers: responseHeaders });
    const body = command.parse(await req.json());
    const revoked = await revokeDeviceSessions(
      actor.userId, actor.sessionId, body.action === "revoke" ? body.sessionId : "others"
    );
    return NextResponse.json({ revoked }, { headers: responseHeaders });
  } catch (err) { return errorResponse(err); }
}
