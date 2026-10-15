import { sql, eq, desc } from "drizzle-orm";
import { entitlementGrants, restaurants } from "@/db/schema";
import { withActor, withOutlet, type Actor, type Permission } from "@/modules/tenancy/service";
import { ForbiddenError } from "@/lib/errors";
import type { Transaction } from "@/db";
export type Capability = "ordering.new" | "kitchen.new";
export async function billingState(actor: Actor, organizationId: string) {
  return withActor(actor, async (tx) => {
    const p = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.org_admin(${organizationId},true,true) as allowed`
    );
    if (!p.rows[0]?.allowed) throw new ForbiddenError();
    const effective = await tx.execute<{ ordering: boolean; kitchen: boolean }>(
      sql`select app_private.entitlement_allowed(${organizationId},'ordering.new') as ordering,app_private.entitlement_allowed(${organizationId},'kitchen.new') as kitchen`
    );
    const grants = await tx
      .select()
      .from(entitlementGrants)
      .where(eq(entitlementGrants.organizationId, organizationId))
      .orderBy(desc(entitlementGrants.createdAt))
      .limit(100);
    return { freeMenu: true, ...effective.rows[0]!, grants };
  });
}
/** Use only for creating NEW paid work. Accepted work completion uses withOutlet alone. */
export async function withEntitledOutlet<T>(
  actor: Actor,
  outletId: string,
  permission: Permission,
  capability: Capability,
  work: (tx: Transaction) => Promise<T>
) {
  return withOutlet(actor, outletId, permission, async (tx) => {
    const outlet = (
      await tx
        .select({ organizationId: restaurants.organizationId })
        .from(restaurants)
        .where(eq(restaurants.id, outletId))
    )[0]!;
    // Holds a shared organization lock until the caller's business transaction commits.
    const r = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.require_entitlement(${outlet.organizationId},${capability}) as allowed`
    );
    if (!r.rows[0]?.allowed)
      throw new ForbiddenError("An active entitlement is required for new work");
    return work(tx);
  });
}
