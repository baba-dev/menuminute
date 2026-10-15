import { NextResponse } from "next/server";
import { requestActor, errorResponse } from "@/lib/request-context";
import { billingState } from "@/modules/billing/service";
export async function GET(req: Request, context: { params: Promise<{ organizationId: string }> }) {
  try {
    return NextResponse.json(
      await billingState(await requestActor(req), (await context.params).organizationId)
    );
  } catch (e) {
    return errorResponse(e);
  }
}
