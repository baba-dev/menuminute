import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { posWorkspace, posSubmit, posAttachOrder } from "@/modules/pos/service";

type Params = { params: Promise<{ organizationId: string; outletId: string }> };
export async function GET(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    return NextResponse.json(await posWorkspace(actor, organizationId, outletId), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const body = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("submit"), input: z.unknown() }).strict(),
        z.object({ action: z.literal("attach"), input: z.unknown() }).strict(),
      ])
      .parse(await req.json());
    const result =
      body.action === "submit"
        ? await posSubmit(actor, organizationId, outletId, body.input)
        : await posAttachOrder(actor, organizationId, outletId, body.input);
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}
