import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { needsMfaEnrollment } from "@/lib/privileged-access";
import { getDefaultOrActiveRestaurant, getRestaurantById } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  AppError,
  serializeError,
} from "@/lib/errors";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
export async function requestActor(req: Request, mutation = false) {
  if (
    mutation &&
    (req.headers.get("origin") !== new URL(env.APP_URL).origin ||
      !req.headers.get("content-type")?.startsWith("application/json"))
  )
    throw new ForbiddenError();
  const session = await auth();
  if (!session?.user.id) throw new UnauthorizedError();
  if (await needsMfaEnrollment(session.user.id, Boolean(session.user.twoFactorEnabled)))
    throw new ForbiddenError("Enroll two-factor authentication");
  return { userId: session.user.id, sessionId: session.session.id };
}
export async function requestContext(req: Request, mutation = false) {
  const actor = await requestActor(req, mutation);
  const selector = req.headers.get("x-outlet-id");
  const outlet = selector
    ? await getRestaurantById(actor, selector)
    : await getDefaultOrActiveRestaurant(
        actor.userId,
        (await cookies()).get("menuminute.outlet")?.value
      );
  if (!outlet) throw new NotFoundError("Outlet");
  return { actor, restaurant: outlet };
}
export function errorResponse(err: unknown) {
  if (err instanceof ZodError)
    return NextResponse.json(
      { message: "Invalid input", fields: err.flatten().fieldErrors },
      { status: 422 }
    );
  if (err instanceof SyntaxError)
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400 });
  return NextResponse.json(serializeError(err, false), {
    status: err instanceof AppError ? err.statusCode : 500,
  });
}
