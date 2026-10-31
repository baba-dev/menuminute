import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { getDefaultOrActiveRestaurant, getRestaurantById } from "@/modules/restaurants/service";
import { env } from "@/lib/config/env";
import {
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  AppError,
  RateLimitError,
  serializeError,
} from "@/lib/errors";
import { logRequestError, requestId } from "@/lib/observability";
import { setTraceContext } from "@/lib/tracing";
import { telemetry } from "@/lib/telemetry";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { demoRequestAllowed, isDemoActor } from "@/modules/demo/guard";
export async function requestActor(
  req: Request,
  mutation = false,
  options: { verified?: boolean } = {}
) {
  if (
    mutation &&
    (req.headers.get("origin") !== new URL(env.APP_URL).origin ||
      !req.headers.get("content-type")?.startsWith("application/json"))
  )
    throw new ForbiddenError();
  const session = await auth();
  if (!session?.user.id) throw new UnauthorizedError();
  // Email verification is deferred; sensitive actions (billing, invitations) still require it.
  if (options.verified && !session.user.emailVerified)
    throw new ForbiddenError("Verify your email address to continue.");
  // Public demo: the shared account may only perform allowlisted, resettable mutations.
  if (isDemoActor(session.user.id) && !demoRequestAllowed(req.method, new URL(req.url).pathname))
    throw new ForbiddenError("This action is disabled in the public demo.");
  setTraceContext({ actorId: session.user.id });
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
  setTraceContext({
    actorId: actor.userId,
    outletId: outlet.id,
    organizationId: outlet.organizationId,
  });
  return { actor, restaurant: outlet };
}
export function errorResponse(err: unknown, req?: Request) {
  const status =
    err instanceof ZodError
      ? 422
      : err instanceof SyntaxError
        ? 400
        : err instanceof AppError
          ? err.statusCode
          : 500;
  if (req) {
    logRequestError(req, err, status);
  } else {
    telemetry.recordRequest(status, 0);
  }
  const headers = new Headers();
  if (req) headers.set("x-request-id", requestId(req));
  if (err instanceof RateLimitError) headers.set("retry-after", String(err.retryAfterSeconds));
  if (err instanceof ZodError)
    return NextResponse.json(
      { message: "Invalid input", fields: err.flatten().fieldErrors },
      { status: 422, headers }
    );
  if (err instanceof SyntaxError)
    return NextResponse.json({ message: "Invalid JSON" }, { status: 400, headers });
  return NextResponse.json(serializeError(err, false), {
    status,
    headers,
  });
}
