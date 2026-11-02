import { LimitReachedError } from "@/lib/errors";
import {
  PLAN_LABELS,
  PLAN_LIMITS,
  PLAN_ORDER,
  RESOURCE_LABELS,
  type LimitResource,
  type PlanKey,
  type PlanLimits,
} from "./catalog";

/** Server-derived entitlement facts. Never built from request input. */
export type PlanFacts = {
  ordering: boolean;
  kitchen: boolean;
  /** True only for organizations an operator has explicitly contracted as Dedicated. */
  dedicated?: boolean;
};

/**
 * Highest active plan wins; Kitchen Pro implies Ordering. Without any active
 * paid entitlement the organization is Free (the permanent QR menu always remains).
 */
export function resolvePlan(facts: PlanFacts): PlanKey {
  if (facts.dedicated) return "dedicated";
  if (facts.kitchen) return "kitchen_pro";
  if (facts.ordering) return "ordering";
  return "free";
}

/** Operator overrides may only raise or lift a cap, never lower it below the plan's. */
export type LimitOverrides = Partial<Record<LimitResource, number | null>>;

export function resolveLimits(plan: PlanKey, overrides: LimitOverrides = {}): PlanLimits {
  const base = PLAN_LIMITS[plan];
  const out = { ...base } as Record<LimitResource, number | null>;
  for (const key of Object.keys(overrides) as LimitResource[]) {
    const wanted = overrides[key];
    if (wanted === undefined) continue;
    const current = base[key];
    if (current === null) continue; // already uncapped
    if (wanted === null) out[key] = null;
    else if (Number.isFinite(wanted) && wanted > current) out[key] = Math.floor(wanted);
  }
  return out;
}

export type LimitCheck =
  | { allowed: true; remaining: number | null }
  | { allowed: false; limit: number; remaining: 0; upgradeTo: PlanKey | null };

/** The next plan whose cap for `resource` would allow `needed` units, or null. */
export function upgradeTargetFor(
  plan: PlanKey,
  resource: LimitResource,
  needed: number
): PlanKey | null {
  const start = PLAN_ORDER.indexOf(plan);
  for (const candidate of PLAN_ORDER.slice(start + 1)) {
    if (candidate === "dedicated") return null; // contract-only; not a self-serve target
    const cap = PLAN_LIMITS[candidate][resource];
    if (cap === null || cap >= needed) return candidate;
  }
  return null;
}

/**
 * Pure cap check. `current` must be counted inside the same transaction as the
 * write (later slices); this function does no counting or I/O.
 */
export function checkLimit(
  plan: PlanKey,
  limits: PlanLimits,
  resource: LimitResource,
  current: number,
  adding = 1
): LimitCheck {
  if (!Number.isInteger(current) || current < 0 || !Number.isInteger(adding) || adding < 1)
    throw new RangeError("current must be a non-negative integer and adding a positive integer");
  const cap = limits[resource];
  if (cap === null) return { allowed: true, remaining: null };
  if (current + adding <= cap) return { allowed: true, remaining: cap - current - adding };
  return {
    allowed: false,
    limit: cap,
    remaining: 0,
    upgradeTo: upgradeTargetFor(plan, resource, current + adding),
  };
}

/** Throws a typed LIMIT_REACHED error naming the resource, cap and next plan. */
export function assertWithinLimit(
  plan: PlanKey,
  limits: PlanLimits,
  resource: LimitResource,
  current: number,
  adding = 1
): void {
  const result = checkLimit(plan, limits, resource, current, adding);
  if (!result.allowed)
    throw new LimitReachedError(
      RESOURCE_LABELS[resource],
      result.limit,
      result.upgradeTo ? PLAN_LABELS[result.upgradeTo] : null
    );
}
