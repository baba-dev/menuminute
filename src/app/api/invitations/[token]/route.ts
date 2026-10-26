import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { invitationPreview, acceptInvitation } from "@/modules/onboarding/service";
type C = { params: Promise<{ token: string }> };
const noStore = { "cache-control": "no-store", "referrer-policy": "no-referrer" };
export async function GET(req: Request, c: C) {
  try {
    return NextResponse.json(
      await invitationPreview(await requestActor(req), (await c.params).token),
      { headers: noStore }
    );
  } catch (e) {
    const r = errorResponse(e, req);
    Object.entries(noStore).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}
export async function POST(req: Request, c: C) {
  try {
    return NextResponse.json(
      await acceptInvitation(await requestActor(req, true), (await c.params).token),
      { headers: noStore }
    );
  } catch (e) {
    const r = errorResponse(e, req);
    Object.entries(noStore).forEach(([k, v]) => r.headers.set(k, v));
    return r;
  }
}
