import { assertWithinLimit, resolveLimits, resolvePlan, type PlanFacts } from "./limits";
import type { PlanKey, PlanLimits } from "./catalog";

/** Resources enforced at write time in slice 2. */
export type GuardedResource = "dishes" | "qrCodes";

export type PlanContext = { plan: PlanKey; limits: PlanLimits };

/**
 * Storage seam so the rule can be unit-tested without a database. The Postgres
 * implementation lives in `./store.ts`; every call runs inside the caller's
 * transaction, so the lock, counts and the guarded write commit or roll back together.
 */
export interface PlanStore {
  /** Serialize concurrent writers for these outlets until the transaction ends. */
  lock(outletIds: readonly string[]): Promise<void>;
  /** Server-derived plan for the outlet's organization; null if the outlet is not visible. */
  facts(outletId: string): Promise<(PlanFacts & { community: boolean }) | null>;
  count(outletId: string, resource: GuardedResource): Promise<number>;
}

export async function planContextFor(
  store: PlanStore,
  outletId: string
): Promise<PlanContext | null> {
  const facts = await store.facts(outletId);
  if (!facts) return null;
  // Self-hosted Community Edition is a single-user deployment: never cap it.
  const plan = facts.community ? "dedicated" : resolvePlan(facts);
  return { plan, limits: resolveLimits(plan) };
}

/**
 * Run `work`, then reject (and let the caller's transaction roll back) if it grew an outlet's
 * count of `resource` past the plan cap.
 *
 * Only *growth beyond the cap* is rejected. An outlet already over its cap (a downgrade, or
 * data created before caps existed) can still edit, reduce or reorder; nothing is ever deleted.
 */
export async function enforceCap<T>(
  store: PlanStore,
  outletIds: readonly string[],
  resource: GuardedResource,
  work: () => Promise<T>
): Promise<T> {
  const ids = [...new Set(outletIds)].sort();
  await store.lock(ids);
  const scoped: { id: string; ctx: PlanContext; before: number }[] = [];
  for (const id of ids) {
    const ctx = await planContextFor(store, id);
    if (!ctx || ctx.limits[resource] === null) continue;
    scoped.push({ id, ctx, before: await store.count(id, resource) });
  }
  const result = await work();
  for (const { id, ctx, before } of scoped) {
    const after = await store.count(id, resource);
    if (after > before) assertWithinLimit(ctx.plan, ctx.limits, resource, before, after - before);
  }
  return result;
}
