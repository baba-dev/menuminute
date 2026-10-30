import { eq } from "drizzle-orm";
import { accountWorkspacePreferences } from "@/db/schema";
import { withActor, type Actor } from "@/modules/tenancy/service";
import {
  dashboardLayoutInput,
  defaultDashboardLayout,
  normalizeDashboardLayout,
  type DashboardLayout,
} from "./layout";

/** Presentation preference for the signed-in user only; never an authorization input. */
export async function readDashboardLayout(userId: string): Promise<DashboardLayout> {
  const rows = await withActor({ userId }, (tx) =>
    tx
      .select({ layout: accountWorkspacePreferences.dashboardLayout })
      .from(accountWorkspacePreferences)
      .where(eq(accountWorkspacePreferences.userId, userId))
      .limit(1)
  );
  return normalizeDashboardLayout(rows[0]?.layout);
}

/** Full replace. Leaves the organization/outlet default untouched when the row already exists. */
export async function saveDashboardLayout(actor: Actor, raw: unknown): Promise<DashboardLayout> {
  const layout = dashboardLayoutInput.parse(raw);
  await withActor(actor, (tx) =>
    tx
      .insert(accountWorkspacePreferences)
      .values({ userId: actor.userId, dashboardLayout: layout })
      .onConflictDoUpdate({
        target: accountWorkspacePreferences.userId,
        set: { dashboardLayout: layout, updatedAt: new Date() },
      })
  );
  return layout;
}

export async function resetDashboardLayout(actor: Actor): Promise<DashboardLayout> {
  await withActor(actor, (tx) =>
    tx
      .update(accountWorkspacePreferences)
      .set({ dashboardLayout: null, updatedAt: new Date() })
      .where(eq(accountWorkspacePreferences.userId, actor.userId))
  );
  return defaultDashboardLayout;
}
