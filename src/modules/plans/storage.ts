import { sql } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { LimitReachedError } from "@/lib/errors";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import { PLAN_LABELS, type PlanKey } from "./catalog";
import { planContextFor } from "./guard";
import { upgradeTargetFor } from "./limits";
import { dbPlanStore } from "./store";

const MB = 1024 * 1024;

export type MediaBudget = {
  /** Bytes the outlet may store: the plan's cap while limits are enforced, else the operational default. */
  budget: number;
  /** The plan's own cap, or null when it does not apply (limits off, or a contract plan). */
  planCap: number | null;
  plan: PlanKey | null;
};

/**
 * Photo storage per outlet. The database already refuses an upload that would pass the budget it is given;
 * this decides which budget that is. While plan limits are enforced it is the plan's cap (Free 100 MB,
 * Ordering 300 MB, Kitchen Pro 500 MB per outlet); Dedicated is by contract, so it keeps the operational
 * default (`MEDIA_OUTLET_BUDGET_BYTES`), as does everything while limits are switched off.
 */
export async function mediaBudgetFor(actor: Actor, outletId: string): Promise<MediaBudget> {
  const fallback = { budget: env.MEDIA_OUTLET_BUDGET_BYTES, planCap: null, plan: null };
  if (!env.PLAN_LIMITS_ENFORCED) return fallback;
  const ctx = await withOutlet(actor, outletId, "menu.read", (tx) =>
    planContextFor(dbPlanStore(tx), outletId)
  );
  if (!ctx) return fallback;
  const cap = ctx.limits.mediaBytes;
  return cap === null
    ? { ...fallback, plan: ctx.plan }
    : { budget: cap, planCap: cap, plan: ctx.plan };
}

/** The friendly error for an upload the plan's storage cannot hold, or null if the cap is not the reason. */
export async function storageLimitError(
  actor: Actor,
  outletId: string,
  media: MediaBudget,
  addingBytes: number
): Promise<LimitReachedError | null> {
  if (media.planCap === null || media.plan === null) return null;
  const used = await withOutlet(actor, outletId, "menu.read", async (tx) => {
    const r = await tx.execute<{ n: string | null }>(
      sql`select app_private.media_usage_bytes(${outletId}) as n`
    );
    return Number(r.rows[0]?.n ?? 0);
  });
  if (used + addingBytes <= media.planCap) return null;
  const next = upgradeTargetFor(media.plan, "mediaBytes", used + addingBytes);
  return new LimitReachedError(
    "MB of photo storage",
    Math.floor(media.planCap / MB),
    next ? PLAN_LABELS[next] : null
  );
}
