import { sql } from "drizzle-orm";
import type { Transaction } from "@/db";
import { env } from "@/lib/config/env";
import { enforceCap, type GuardedResource, type PlanStore } from "./guard";

/** PostgreSQL store bound to the caller's transaction. */
export function dbPlanStore(tx: Transaction): PlanStore {
  return {
    async lock(outletIds) {
      for (const id of outletIds)
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${"plan-cap:" + id}, 0))`
        );
    },
    async facts(outletId) {
      const rows = await tx.execute<{
        ordering: boolean;
        kitchen: boolean;
        community: boolean;
      }>(sql`
        select app_private.entitlement_allowed(r.organization_id,'ordering.new') as ordering,
               app_private.entitlement_allowed(r.organization_id,'kitchen.new') as kitchen,
               app_private.is_community_edition() as community
        from restaurants r where r.id = ${outletId}`);
      const row = rows.rows[0];
      return row
        ? {
            ordering: row.ordering === true,
            kitchen: row.kitchen === true,
            community: row.community === true,
          }
        : null;
    },
    async count(outletId, resource) {
      if (resource === "qrCodes") {
        const rows = await tx.execute<{ n: number }>(
          sql`select count(*)::int as n from qr_codes where restaurant_id = ${outletId} and is_active`
        );
        return rows.rows[0]?.n ?? 0;
      }
      if (resource === "outlets") {
        // Active outlets in the same organization as the given outlet.
        const rows = await tx.execute<{ n: number }>(sql`
          select count(*)::int as n from restaurants
          where is_active and organization_id = (select organization_id from restaurants where id = ${outletId})`);
        return rows.rows[0]?.n ?? 0;
      }
      if (resource === "tables") {
        // Numbered floor tables only; legacy QR-only tables have no display number and never count.
        const rows = await tx.execute<{ n: number }>(sql`
          select count(*)::int as n from restaurant_tables
          where restaurant_id = ${outletId} and is_active and display_number is not null`);
        return rows.rows[0]?.n ?? 0;
      }
      if (resource === "chairs") {
        const rows = await tx.execute<{ n: number }>(
          sql`select count(*)::int as n from restaurant_chairs where outlet_id = ${outletId} and is_active`
        );
        return rows.rows[0]?.n ?? 0;
      }
      // Distinct dish ids across live (non-archived) menus the outlet owns or is assigned.
      const rows = await tx.execute<{ n: number }>(sql`
        select count(distinct item->>'id')::int as n
        from menus m
        cross join lateral jsonb_array_elements(coalesce(m.document->'categories','[]'::jsonb)) as c
        cross join lateral jsonb_array_elements(coalesce(c->'items','[]'::jsonb)) as item
        where not m.archived
          and item ? 'id'
          and (m.outlet_id = ${outletId}
               or exists (select 1 from menu_assignments a
                          where a.menu_id = m.id and a.outlet_id = ${outletId}))`);
      return rows.rows[0]?.n ?? 0;
    },
  };
}

/**
 * Service-layer entry point. A no-op unless `PLAN_LIMITS_ENFORCED=true`, so merging this code
 * does not change behavior for any outlet until the operator enables it.
 */
export async function withPlanCap<T>(
  tx: Transaction,
  outletIds: readonly string[],
  resource: GuardedResource,
  work: () => Promise<T>
): Promise<T> {
  if (!env.PLAN_LIMITS_ENFORCED) return work();
  return enforceCap(dbPlanStore(tx), outletIds, resource, work);
}
