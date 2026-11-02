import { resolveLimits, resolvePlan } from "./limits";
import type { PlanKey } from "./catalog";

/** One row per outlet, as read by `scripts/plan-cap-audit.ts`. */
export type AuditRow = {
  outletId: string;
  organizationId: string;
  slug: string;
  demo: boolean;
  ordering: boolean;
  kitchen: boolean;
  community: boolean;
  outlets: number;
  dishes: number;
  qrCodes: number;
  tables: number;
  chairs: number;
};

export type AuditEntry = AuditRow & {
  plan: PlanKey;
  dishCap: number | null;
  qrCap: number | null;
  dishesOver: number;
  qrCodesOver: number;
  tablesCap: number | null;
  chairsCap: number | null;
  tablesOver: number;
  chairsOver: number;
  outletsCap: number | null;
  outletsOver: number;
  /** Would be unable to add more (at or over a cap). */
  atOrOver: boolean;
};

export type CapAudit = {
  entries: AuditEntry[];
  /** Outlets strictly over a cap today: they cannot add, and slice 3 will hide extras. */
  over: AuditEntry[];
  summary: {
    outlets: number;
    byPlan: Record<PlanKey, number>;
    overCount: number;
    atCapCount: number;
    communityExcluded: number;
  };
};

const over = (count: number, cap: number | null) => (cap === null ? 0 : Math.max(0, count - cap));

/** Pure: classify outlets against the approved caps. No I/O. */
export function buildCapAudit(rows: readonly AuditRow[]): CapAudit {
  const byPlan: Record<PlanKey, number> = { free: 0, ordering: 0, kitchen_pro: 0, dedicated: 0 };
  let communityExcluded = 0;
  const entries: AuditEntry[] = rows.map((row) => {
    // Community Edition is never capped (same rule as the write guard).
    const plan: PlanKey = row.community ? "dedicated" : resolvePlan(row);
    if (row.community) communityExcluded += 1;
    byPlan[plan] += 1;
    const limits = resolveLimits(plan);
    const dishesOver = over(row.dishes, limits.dishes);
    const qrCodesOver = over(row.qrCodes, limits.qrCodes);
    const tablesOver = over(row.tables, limits.tables);
    const chairsOver = over(row.chairs, limits.chairs);
    const outletsOver = over(row.outlets, limits.outlets);
    const atCap = (n: number, cap: number | null) => cap !== null && n >= cap;
    return {
      ...row,
      plan,
      dishCap: limits.dishes,
      qrCap: limits.qrCodes,
      dishesOver,
      qrCodesOver,
      tablesCap: limits.tables,
      chairsCap: limits.chairs,
      tablesOver,
      chairsOver,
      outletsCap: limits.outlets,
      outletsOver,
      atOrOver:
        atCap(row.dishes, limits.dishes) ||
        atCap(row.qrCodes, limits.qrCodes) ||
        atCap(row.tables, limits.tables) ||
        atCap(row.chairs, limits.chairs),
    };
  });
  const total = (e: AuditEntry) =>
    e.dishesOver + e.qrCodesOver + e.tablesOver + e.chairsOver + e.outletsOver;
  const overEntries = entries.filter((e) => total(e) > 0).sort((a, b) => total(b) - total(a));
  return {
    entries,
    over: overEntries,
    summary: {
      outlets: entries.length,
      byPlan,
      overCount: overEntries.length,
      atCapCount: entries.filter((e) => e.atOrOver).length,
      communityExcluded,
    },
  };
}
