import { NextResponse } from "next/server";
import { requestContext, errorResponse } from "@/lib/request-context";
import { withOutlet } from "@/modules/tenancy/service";
import { importEngineEnabled } from "@/modules/menu-import/nvidia";
export async function GET(req: Request) {
  try {
    const { actor, restaurant } = await requestContext(req);
    await withOutlet(actor, restaurant.id, "menu.write", async () => true);
    return NextResponse.json(
      { enabled: importEngineEnabled() },
      {
        headers: { "Cache-Control": "private, no-store" },
      }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
