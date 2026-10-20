import { listOrganizations, domainError } from "@/modules/organizations/service";
import { requestActor } from "@/lib/request-context";
import { z } from "zod";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createRestaurant } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
import { errorResponse } from "@/lib/request-context";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
export async function POST(req: Request) {
  try {
    if (
      req.headers.get("origin") !== new URL(env.APP_URL).origin ||
      !req.headers.get("content-type")?.startsWith("application/json")
    )
      throw new ForbiddenError();
    const session = await auth();
    if (!session?.user.id) throw new UnauthorizedError();
    const outlet = await createRestaurant(
      session.user.id,
      await req.json(),
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

export async function GET(req: Request) {
  try {
    return NextResponse.json(await listOrganizations(await requestActor(req)));
  } catch (e) {
    return errorResponse(e);
  }
}
