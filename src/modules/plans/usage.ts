import { sql } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import { planContextFor } from "./guard";
import { dbPlanStore } from "./store";
import { buildPlanUsageView, type IntakeSnapshot, type PlanUsageView } from "./view";

/**
 * Read-only usage snapshot for one outlet, for meters and plan panels.
 *
 * Returns null (renders nothing) when plan limits are not enforced, the plan has no meaningful
 * caps, the caller cannot read the outlet, or anything goes wrong. A usage widget must never
 * break the page it decorates.
 */
export async function getPlanUsageView(
  actor: Actor,
  outletId: string
): Promise<PlanUsageView | null> {
  if (!env.PLAN_LIMITS_ENFORCED) return null;
  try {
    return await withOutlet(actor, outletId, "menu.read", async (tx) => {
      const store = dbPlanStore(tx);
      const ctx = await planContextFor(store, outletId);
      if (!ctx) return null;
      const [dishes, qrCodes] = await Promise.all([
        store.count(outletId, "dishes"),
        store.count(outletId, "qrCodes"),
      ]);
      let intake: IntakeSnapshot | null = null;
      if (ctx.plan === "free") {
        const row = await tx.execute<{ snap: IntakeSnapshot | null }>(
          sql`select app_private.free_intake_snapshot(${outletId}) as snap`
        );
        intake = row.rows[0]?.snap ?? null;
      }
      return buildPlanUsageView({
        plan: ctx.plan,
        limits: ctx.limits,
        counts: { dishes, qrCodes },
        intake,
      });
    });
  } catch {
    return null;
  }
}
