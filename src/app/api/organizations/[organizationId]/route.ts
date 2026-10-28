import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { organizationDetail, manageOrganization } from "@/modules/organizations/service";
type Context = { params: Promise<{ organizationId: string }> };
async function observed_GET(req: Request, context: Context) {
  try {
    return NextResponse.json(
      await organizationDetail(await requestActor(req), (await context.params).organizationId)
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}
async function observed_PATCH(req: Request, context: Context) {
  try {
    return NextResponse.json(
      await manageOrganization(
        await requestActor(req, true),
        (await context.params).organizationId,
        await req.json()
      )
    );
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const GET = observedRoute(observed_GET);
export const PATCH = observedRoute(observed_PATCH);
