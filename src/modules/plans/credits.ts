import { sql } from "drizzle-orm";
import type { Transaction } from "@/db";
import { env } from "@/lib/config/env";
import { AiCreditsExhaustedError } from "@/lib/errors";
import { PLAN_LABELS } from "./catalog";
import { planContextFor } from "./guard";
import { dbPlanStore } from "./store";
import { upgradeTargetFor } from "./limits";

/**
 * AI credits: a monthly allowance pooled across an organization's outlets (migration 0088).
 * One credit is one merchant-initiated AI request. Guest-facing AI (the menu concierge) has its own
 * budget and never spends the merchant's credits.
 */
export const AI_CREDIT_COSTS = {
  /** One assistant message, however many internal rounds it needs. */
  assistantTurn: 1,
  /** One dish autofill suggestion. */
  dishAutofill: 1,
  /** One page or photo sent to the AI menu import. */
  importSource: 1,
} as const;

/**
 * Spends credits inside the caller's transaction, so the spend commits or rolls back with the work it
 * pays for. A no-op unless plan limits are enforced. Throws AI_CREDITS_EXHAUSTED (402) when the
 * allowance is used up. Returns whether anything was charged, so a failed request can refund it.
 */
export async function spendAiCredits(
  tx: Transaction,
  outletId: string,
  cost: number
): Promise<boolean> {
  if (!env.PLAN_LIMITS_ENFORCED) return false;
  const ctx = await planContextFor(dbPlanStore(tx), outletId);
  if (!ctx) return false;
  const cap = ctx.limits.aiCreditsPerMonth;
  const result = await tx.execute<{
    r: { allowed: boolean; used: number; cap: number | null; resetsAt: string };
  }>(sql`select app_private.ai_credit_spend(${outletId},${cost}::integer,${cap}::integer) as r`);
  const r = result.rows[0]?.r;
  if (!r) return false;
  if (!r.allowed) {
    const next = upgradeTargetFor(ctx.plan, "aiCreditsPerMonth", r.used + cost);
    throw new AiCreditsExhaustedError(r.cap ?? 0, r.resetsAt, next ? PLAN_LABELS[next] : null);
  }
  return true;
}

/** Gives credits back when a request that was charged produced nothing. */
export async function refundAiCredits(
  tx: Transaction,
  outletId: string,
  cost: number
): Promise<void> {
  if (!env.PLAN_LIMITS_ENFORCED) return;
  await tx.execute(sql`select app_private.ai_credit_refund(${outletId},${cost}::integer)`);
}
