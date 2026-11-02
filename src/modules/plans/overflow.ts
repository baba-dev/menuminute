import type { Pool } from "pg";
import { PLAN_LIMITS } from "./catalog";

/**
 * Plan overflow sweep (slice 3). Pure and worker-safe: it imports no env or Redis modules, because
 * the production worker runs with worker-only credentials (the same rule as the demo reset). The
 * public-menu cache (180 s TTL) therefore converges on its own after a change.
 */

/** Dish cap per plan rank (0 Free, 1 Ordering, 2 Kitchen Pro). A missing rank means uncapped. */
export function overflowCapsJson(): string {
  const caps: Record<string, number> = {};
  const entries = [
    ["0", PLAN_LIMITS.free.dishes],
    ["1", PLAN_LIMITS.ordering.dishes],
    ["2", PLAN_LIMITS.kitchen_pro.dishes],
  ] as const;
  for (const [rank, cap] of entries) if (cap !== null) caps[rank] = cap;
  return JSON.stringify(caps);
}

/** The sweep runs unless plan limits are explicitly switched off (PLAN_LIMITS_ENFORCED=false); the database switch is a second, owner-only gate. */
export function planOverflowSweepEnabled(env: Record<string, string | undefined> = process.env) {
  return env["PLAN_LIMITS_ENFORCED"] !== "false";
}

/** Returns the ids of outlets whose hidden set changed. */
export async function reconcilePlanOverflow(pool: Pick<Pool, "query">): Promise<string[]> {
  const { rows } = await pool.query<{ changed: string[] }>(
    "select app_private.reconcile_plan_overflow($1::jsonb) as changed",
    [overflowCapsJson()]
  );
  return rows[0]?.changed ?? [];
}
