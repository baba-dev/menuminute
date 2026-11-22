import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedJson } from "@/lib/bounded-input";
import { errorResponse, requestActor } from "@/lib/request-context";
import { tiffinRoutesEnabled } from "@/modules/tiffin/rate-limit";
import {
  clearOverride,
  readTiffinMenu,
  saveSlot,
  setOverride,
  setWeekMenu,
} from "@/modules/tiffin/service";

interface RouteParams {
  params: Promise<{ outletId: string }>;
}

// The payload is re-validated by the service with its own strict schemas.
const putSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("slot"), slot: z.unknown() }).strict(),
  z.object({ kind: z.literal("week"), week: z.unknown() }).strict(),
  z.object({ kind: z.literal("override"), override: z.unknown() }).strict(),
  z.object({ kind: z.literal("overrideClear"), override: z.unknown() }).strict(),
]);
const notFound = () => NextResponse.json({ message: "Not found" }, { status: 404 });

async function observed_GET(req: Request, { params }: RouteParams) {
  try {
    if (!tiffinRoutesEnabled()) return notFound();
    const actor = await requestActor(req);
    return NextResponse.json(await readTiffinMenu(actor, (await params).outletId));
  } catch (err) {
    return errorResponse(err, req);
  }
}

async function observed_PUT(req: Request, { params }: RouteParams) {
  try {
    if (!tiffinRoutesEnabled()) return notFound();
    const actor = await requestActor(req, true);
    const { outletId } = await params;
    const body = putSchema.parse(await boundedJson(req));
    switch (body.kind) {
      case "slot":
        return NextResponse.json(await saveSlot(actor, outletId, body.slot));
      case "week":
        return NextResponse.json(await setWeekMenu(actor, outletId, body.week));
      case "override":
        return NextResponse.json(await setOverride(actor, outletId, body.override));
      case "overrideClear":
        return NextResponse.json(await clearOverride(actor, outletId, body.override));
    }
  } catch (err) {
    return errorResponse(err, req);
  }
}

export const GET = observedRoute(observed_GET);
export const PUT = observedRoute(observed_PUT);
