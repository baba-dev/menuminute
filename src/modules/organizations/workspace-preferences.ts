import { and, eq } from "drizzle-orm";
import { accountWorkspacePreferences, organizationMembers, organizations } from "@/db/schema";
import { withActor, type Actor } from "@/modules/tenancy/service";
import { ForbiddenError } from "@/lib/errors";

export async function readWorkspacePreference(userId: string) {
  return withActor({ userId }, async (tx) => {
    const rows = await tx.select({
      organizationId: accountWorkspacePreferences.organizationId,
      outletId: accountWorkspacePreferences.outletId,
    }).from(accountWorkspacePreferences)
      .where(eq(accountWorkspacePreferences.userId, userId)).limit(1);
    return rows[0] ?? null;
  });
}

/** Validate current, active membership; a stored preference is NEVER authorization. */
export async function selectWorkspacePreference(actor: Actor, organizationId: string, outletId: string | null) {
  return withActor(actor, async (tx) => {
    const permitted = await tx.select({ id: organizations.id })
      .from(organizations)
      .innerJoin(organizationMembers, eq(organizationMembers.organizationId, organizations.id))
      .where(and(
        eq(organizations.id, organizationId), eq(organizations.isActive, true),
        eq(organizationMembers.userId, actor.userId), eq(organizationMembers.isActive, true)
      )).limit(1);
    if (!permitted.length) throw new ForbiddenError("Organization access changed");
    await tx.insert(accountWorkspacePreferences).values({
      userId: actor.userId, organizationId, outletId,
    }).onConflictDoUpdate({
      target: accountWorkspacePreferences.userId,
      set: { organizationId, outletId, updatedAt: new Date() },
    });
  });
}
