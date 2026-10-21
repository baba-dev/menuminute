import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { users, adminAuditLogs } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ForbiddenError } from "@/lib/errors";
import { withActor } from "@/modules/tenancy/service";

export const SUPERADMIN_EMAIL = "admin@bababuilds.com";

export interface AdminActor {
  id: string;
  email: string;
  name: string;
  twoFactorEnabled: boolean;
  sessionId?: string;
}

export async function verifySuperAdmin(): Promise<AdminActor> {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?next=/admin");
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user) {
    redirect("/login?next=/admin");
  }

  const isSuper = user.isSuperAdmin;
  if (!isSuper) {
    throw new ForbiddenError(
      "Superadmin privileges required to access the Platform Control Plane."
    );
  }

  // Superadmins MUST have 2FA enabled
  if (!user.twoFactorEnabled) {
    redirect("/account/security?notice=2fa_required_for_admin");
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    twoFactorEnabled: user.twoFactorEnabled,
    sessionId: session.session.id,
  };
}

export async function recordAdminAction(
  actor: AdminActor,
  action: string,
  targetType: string,
  targetId?: string | null,
  details?: Record<string, unknown>
) {
  const reqHeaders = await headers();
  const ip = reqHeaders.get("x-forwarded-for") || reqHeaders.get("x-real-ip") || "unknown";
  const userAgent = reqHeaders.get("user-agent") || "unknown";

  await withActor({ userId: actor.id, sessionId: actor.sessionId }, async (tx) => {
    await tx.insert(adminAuditLogs).values({
      id: crypto.randomUUID(),
      actorId: actor.id,
      actorEmail: actor.email,
      action,
      targetType,
      targetId: targetId ?? null,
      details: details ?? null,
      ipAddress: ip,
      userAgent,
    });
  });
}

/**
 * All privileged platform writes are executed by the versioned database
 * command gateway. It validates the live session, consumes an existing
 * one-use password+TOTP proof and commits business state + audit atomically.
 */
export async function runAdminCommand<T = Record<string, unknown>>(
  actor: AdminActor,
  action: string,
  targetId: string,
  data: Record<string, unknown> = {},
  requestKey = crypto.randomUUID()
): Promise<T> {
  if (!actor.sessionId) throw new ForbiddenError("An active operator session is required");
  const result = await withActor(
    { userId: actor.id, sessionId: actor.sessionId },
    (tx) =>
      tx.execute<{ result: T }>(
        sql`SELECT app_private.admin_command(
          ${action}, ${targetId}, ${JSON.stringify(data)}::jsonb, ${requestKey}
        ) AS result`
      )
  );
  if (!result.rows[0]) throw new Error("Administrative command did not return a receipt");
  return result.rows[0].result;
}
