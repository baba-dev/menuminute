import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { boundedJson } from "@/lib/bounded-input";
import { errorResponse, requestActor } from "@/lib/request-context";
import { tiffinRoutesEnabled } from "@/modules/tiffin/rate-limit";
import { saveCombo, setComboArchived } from "@/modules/tiffin/service";

interface RouteParams {
  params: Promise<{ outletId: string }>;
}
const notFound = () => NextResponse.json({ message: "Not found" }, { status: 404 });

/** Create (no id) or fully replace (id) a combo. */
async function observed_POST(req: Request, { params }: RouteParams) {
  try {
    if (!tiffinRoutesEnabled()) return notFound();
    const actor = await requestActor(req, true);
    const { outletId } = await params;
    return NextResponse.json(await saveCombo(actor, outletId, await boundedJson(req)));
  } catch (err) {
    return errorResponse(err, req);
  }
}

/** Archive or restore a combo. */
async function observed_PATCH(req: Request, { params }: RouteParams) {
  try {
    if (!tiffinRoutesEnabled()) return notFound();
    const actor = await requestActor(req, true);
    const { outletId } = await params;
    return NextResponse.json(await setComboArchived(actor, outletId, await boundedJson(req)));
  } catch (err) {
    return errorResponse(err, req);
  }
}

export const POST = observedRoute(observed_POST);
export const PATCH = observedRoute(observed_PATCH);
