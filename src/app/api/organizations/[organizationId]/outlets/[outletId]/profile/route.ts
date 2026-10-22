import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { saveOutletProfile } from "@/modules/restaurants/profile";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ organizationId: string; outletId: string }> }
) {
  try {
    const actor = await requestActor(req, true);
    const { organizationId, outletId } = await params;
    return NextResponse.json(
      await saveOutletProfile(actor, organizationId, outletId, await req.json()),
      { headers: { "cache-control": "private, no-store" } }
    );
  } catch (e) {
    return errorResponse(e);
  }
}
