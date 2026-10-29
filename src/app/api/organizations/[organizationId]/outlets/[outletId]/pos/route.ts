import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requestActor, errorResponse } from "@/lib/request-context";
import { posWorkspace, posSubmit, posAttachOrder, posRecentPage } from "@/modules/pos/service";

type Params = { params: Promise<{ organizationId: string; outletId: string }> };
async function observed_GET(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    const url = new URL(req.url);
    if (url.searchParams.get("view") === "recent") {
      const raw = url.searchParams.get("page") ?? "0";
      if (!/^(0|[1-9][0-9]{0,3})$/.test(raw) || Number(raw) > 1000)
        return NextResponse.json({ message: "Invalid register page" }, { status: 400, headers: { "cache-control": "private, no-store" } });
      return NextResponse.json(await posRecentPage(actor, organizationId, outletId, Number(raw)), { headers: { "cache-control": "private, no-store" } });
    }
    return NextResponse.json(await posWorkspace(actor, organizationId, outletId), {
      headers: { "cache-control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}
async function observed_POST(req: Request, { params }: Params) {
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

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
