import { auth } from "@/lib/auth";
import { getDb } from "@/db";
import { users, adminAuditLogs, organizations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ForbiddenError } from "@/lib/errors";
import { withActor } from "@/modules/tenancy/service";

export const SUPERADMIN_EMAIL = "admin@bababuilds.com";
export const DIAGNOSTIC_COOKIE_NAME = "menuminute_admin_diagnostic_org";

export interface AdminActor {
  id: string;
  email: string;
  name: string;
  twoFactorEnabled: boolean;
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

  const isSuper = user.isSuperAdmin || user.email === SUPERADMIN_EMAIL;
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

  await withActor({ userId: actor.id }, async (tx) => {
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

export async function getDiagnosticContext(): Promise<{
  isDiagnostic: boolean;
  organizationId?: string;
  organizationName?: string;
}> {
  const cookieStore = await cookies();
  const diagnosticOrgId = cookieStore.get(DIAGNOSTIC_COOKIE_NAME)?.value;
  if (!diagnosticOrgId) {
    return { isDiagnostic: false };
  }

  const session = await auth();
  if (!session?.user?.id) return { isDiagnostic: false };

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, session.user.id),
  });

  if (!user?.isSuperAdmin && user?.email !== SUPERADMIN_EMAIL) {
    return { isDiagnostic: false };
  }

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, diagnosticOrgId),
  });

  if (!org) return { isDiagnostic: false };

  return {
    isDiagnostic: true,
    organizationId: org.id,
    organizationName: org.name,
  };
}
