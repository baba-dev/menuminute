import { observedRoute } from "@/lib/observed-route";
import { listOrganizations, domainError } from "@/modules/organizations/service";
import { requestActor } from "@/lib/request-context";
import { z } from "zod";
import { NextResponse } from "next/server";
import { createRestaurant } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
import { errorResponse } from "@/lib/request-context";
import { boundedJson } from "@/lib/bounded-input";
import { ForbiddenError } from "@/lib/errors";
async function observed_POST(req: Request) {
  try {
    if (
      req.headers.get("origin") !== new URL(env.APP_URL).origin ||
      !req.headers.get("content-type")?.startsWith("application/json")
    )
      throw new ForbiddenError();
    // Do not let the shared demo actor provision outside the resettable sandbox.
    const actor = await requestActor(req, true);
    const outlet = await createRestaurant(
      actor.userId,
      await boundedJson(req),
      z.string().uuid().parse(req.headers.get("idempotency-key"))
    );
    return NextResponse.json({ outletId: outlet.id }, { status: 201 });
  } catch (e) {
    try {
      domainError(e);
    } catch (mapped) {
      return errorResponse(mapped);
    }
  }
}

async function observed_GET(req: Request) {
  try {
    return NextResponse.json(await listOrganizations(await requestActor(req)));
  } catch (e) {
    return errorResponse(e, req);
  }
}

export const POST = observedRoute(observed_POST);
export const GET = observedRoute(observed_GET);
