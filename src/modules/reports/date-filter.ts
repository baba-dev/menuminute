import { sql, type SQL } from "drizzle-orm";

/** Index-friendly coalesce(business_date, local(created_at)) date filter.
 * Normal rows use the existing partial business-date reporting index.
 * Legacy rows with NULL dates fall back to the created_at composite index.
 * Business date always remains authoritative when present.
 */
export function reportOrderDateFilter(
  scope: "orders" | "joined",
  from: string,
  to: string,
  timezone: string
): SQL {
  const businessDate = scope === "joined" ? sql.raw("o.business_date") : sql.raw("business_date");
  const createdAt = scope === "joined" ? sql.raw("o.created_at") : sql.raw("created_at");
  return sql`(
    ${businessDate} between ${from}::date and ${to}::date
    or (
      ${businessDate} is null
      and ${createdAt} >= (${from}::date::timestamp at time zone ${timezone})
      and ${createdAt} < ((${to}::date + 1)::timestamp at time zone ${timezone})
    )
  )`;
}
