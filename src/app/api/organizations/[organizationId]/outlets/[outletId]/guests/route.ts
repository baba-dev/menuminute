import { NextResponse } from "next/server";
import { z } from "zod";
import { observedRoute } from "@/lib/observed-route";
import { boundedJson } from "@/lib/bounded-input";
import { requestActor, errorResponse } from "@/lib/request-context";
import { lookupGuest, listGuests, guestDetail, saveGuest, eraseGuest } from "@/modules/crm/service";

type Params = { params: Promise<{ organizationId: string; outletId: string }> };
const privateHeaders = { "cache-control": "private, no-store" };
async function get(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    const url = new URL(req.url);
    const action = url.searchParams.get("view");
    const result =
      action === "lookup"
        ? await lookupGuest(actor, organizationId, outletId, url.searchParams.get("phone") ?? "")
        : action === "detail"
          ? await guestDetail(actor, organizationId, outletId, url.searchParams.get("id") ?? "")
          : action === null || action === "list"
            ? await listGuests(
                actor,
                organizationId,
                outletId,
                url.searchParams.get("search") ?? "",
                Number(url.searchParams.get("page") ?? "0")
              )
            : z.never().parse(action);
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (err) {
    return errorResponse(err, req);
  }
}
async function post(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const result = await saveGuest(actor, organizationId, outletId, await boundedJson(req));
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (err) {
    return errorResponse(err, req);
  }
}
async function del(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const body = z
      .object({ id: z.string().min(1).max(128) })
      .strict()
      .parse(await boundedJson(req));
    return NextResponse.json(await eraseGuest(actor, organizationId, outletId, body.id), {
      headers: privateHeaders,
    });
  } catch (err) {
    return errorResponse(err, req);
  }
}
export const GET = observedRoute(get);
export const POST = observedRoute(post);
export const DELETE = observedRoute(del);
