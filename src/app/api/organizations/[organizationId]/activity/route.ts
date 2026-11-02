import { NextResponse } from "next/server";
import { z } from "zod";
import { observedRoute } from "@/lib/observed-route";
import { requestActor, errorResponse } from "@/lib/request-context";
import { organizationActivity } from "@/modules/organizations/service";

type Context = { params: Promise<{ organizationId: string }> };

async function observed_GET(req: Request, context: Context) {
  try {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(10000)
      .parse(new URL(req.url).searchParams.get("page") ?? "1");
    const { organizationId } = await context.params;
    const data = await organizationActivity(await requestActor(req), organizationId, page);
    return NextResponse.json(data, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
