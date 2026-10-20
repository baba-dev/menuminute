import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { inviteMember, listInvitations, revokeInvitation } from "@/modules/onboarding/service";
import { z } from "zod";
type C = { params: Promise<{ organizationId: string }> };
export async function GET(req: Request, context: C) {
  try {
    return NextResponse.json(
      await listInvitations(await requestActor(req), (await context.params).organizationId)
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request, context: C) {
  try {
    return NextResponse.json(
      await inviteMember(
        await requestActor(req, true),
        (await context.params).organizationId,
        await req.json()
      ),
      { status: 201 }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request, context: C) {
  try {
    const actor = await requestActor(req, true);
    const body = z
      .object({ id: z.uuid() })
      .strict()
      .parse(await req.json());
    await revokeInvitation(actor, (await context.params).organizationId, body.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
