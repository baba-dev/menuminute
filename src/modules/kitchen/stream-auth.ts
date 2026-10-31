import { authServer } from "@/lib/auth";
import { needsMfaEnrollment } from "@/lib/privileged-access";
import { ForbiddenError, UnauthorizedError, NotFoundError, AppError } from "@/lib/errors";

/**
 * An explicit request-header session read is safe to repeat in an asynchronous
 * SSE producer (unlike reading Next.js request-scoped headers after GET returns).
 * Better Auth validates the current DB session on every poll; no cookie cache.
 */
export async function kitchenStreamActor(req: Request) {
  const session = await authServer.api.getSession({
    headers: req.headers,
    query: { disableRefresh: true },
  });
  if (!session?.user?.id) throw new UnauthorizedError();
  if (await needsMfaEnrollment(session.user.id, Boolean(session.user.twoFactorEnabled)))
    throw new ForbiddenError("Enroll two-factor authentication");
  return { userId: session.user.id, sessionId: session.session.id };
}

export function isKitchenStreamRevocation(error: unknown): boolean {
  return (
    error instanceof UnauthorizedError ||
    error instanceof ForbiddenError ||
    error instanceof NotFoundError ||
    (error instanceof AppError && [401, 403, 404].includes(error.statusCode))
  );
}
