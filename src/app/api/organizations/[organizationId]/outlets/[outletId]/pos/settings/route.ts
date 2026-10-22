import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { posConfigure } from "@/modules/pos/service";
type Params = { params: Promise<{ organizationId: string; outletId: string }> };
export async function POST(req: Request, { params }: Params) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    const result = await posConfigure(actor, organizationId, outletId, await req.json());
    return NextResponse.json(result, { headers: { "cache-control": "private, no-store" } });
  } catch (error) { return errorResponse(error); }
}
