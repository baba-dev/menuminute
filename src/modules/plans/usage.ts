import { sql } from "drizzle-orm";
import { env } from "@/lib/config/env";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import type { PlanKey } from "./catalog";
import { planContextFor } from "./guard";
import { dbPlanStore } from "./store";
import { NO_LIFECYCLE, type LifecycleSnapshot } from "./lifecycle";
import {
  buildPlanUsageView,
  type IntakeSnapshot,
  type OverflowSnapshot,
  type PlanUsageView,
} from "./view";

/** Everything the plan UI needs about one outlet's organization, read-only and server-derived. */
export type PlanSnapshot = {
  organizationId: string;
  plan: PlanKey;
  /** Meters; null while PLAN_LIMITS_ENFORCED is off, so unenforced limits are never advertised. */
  usage: PlanUsageView | null;
  /** Free-intake state, for Free outlets only. */
  intake: IntakeSnapshot | null;
  /** Owners only: may change the plan and see payment controls. */
  canManageBilling: boolean;
  /** Automatic trial and payment-problem state (dunning is visible to owners and admins only). */
  lifecycle: LifecycleSnapshot;
};

/**
 * Returns null on any error or when the caller cannot read the outlet. A plan widget must never
 * break the page it decorates.
 */
export async function getPlanSnapshot(
  actor: Actor,
  outletId: string
): Promise<PlanSnapshot | null> {
  try {
    return await withOutlet(actor, outletId, "menu.read", async (tx) => {
      const store = dbPlanStore(tx);
      const ctx = await planContextFor(store, outletId);
      if (!ctx) return null;
      const scope = await tx.execute<{ org: string; manage: boolean }>(
        sql`select r.organization_id as org,
                   app_private.org_admin(r.organization_id,true,true) as manage
            from restaurants r where r.id = ${outletId}`
      );
      const row = scope.rows[0];
      if (!row) return null;
      let intake: IntakeSnapshot | null = null;
      if (ctx.plan === "free") {
        const snap = await tx.execute<{ snap: IntakeSnapshot | null }>(
          sql`select app_private.free_intake_snapshot(${outletId}) as snap`
        );
        intake = snap.rows[0]?.snap ?? null;
      }
      const life = await tx.execute<{ snap: LifecycleSnapshot | null }>(
        sql`select app_private.plan_lifecycle_snapshot(${outletId}) as snap`
      );
      const lifecycle = life.rows[0]?.snap ?? NO_LIFECYCLE;
      let usage: PlanUsageView | null = null;
      if (env.PLAN_LIMITS_ENFORCED) {
        const over = await tx.execute<{ snap: OverflowSnapshot | null }>(
          sql`select app_private.plan_overflow_snapshot(${outletId}) as snap`
        );
        const [dishes, qrCodes, tables, chairs] = await Promise.all([
          store.count(outletId, "dishes"),
          store.count(outletId, "qrCodes"),
          store.count(outletId, "tables"),
          store.count(outletId, "chairs"),
        ]);
        usage = buildPlanUsageView({
          plan: ctx.plan,
          limits: ctx.limits,
          counts: { dishes, qrCodes, tables, chairs },
          intake,
          overflow: over.rows[0]?.snap ?? null,
        });
      }
      return {
        organizationId: row.org,
        plan: ctx.plan,
        usage,
        intake,
        canManageBilling: row.manage === true,
        lifecycle,
      };
    });
  } catch {
    return null;
  }
}

/**
 * Meters only: null when limits are not enforced, the plan has no meaningful caps, the caller
 * cannot read the outlet, or anything goes wrong.
 */
export async function getPlanUsageView(
  actor: Actor,
  outletId: string
): Promise<PlanUsageView | null> {
  return (await getPlanSnapshot(actor, outletId))?.usage ?? null;
}
