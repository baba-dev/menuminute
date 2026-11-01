import { sql } from "drizzle-orm";
import { outletDayParts, percentChange } from "./pulse-math";
import { reportOrderDateFilter } from "@/modules/reports/date-filter";
import { withOutletRead, type Actor } from "@/modules/tenancy/service";

/**
 * Read model for the dashboard "Today's pulse" bento. Everything is derived from orders and
 * order items for one outlet and one business day. Nothing here is a claim about physical
 * occupancy, kitchen internals or guest identity: phone numbers are only counted, never returned.
 */
export type TodayPulse = {
  currency: string;
  /** Outlet-local hour (0-23) when the snapshot was taken. */
  hour: number;
  sales: {
    grossMinor: number;
    orders: number;
    aovMinor: number;
    /** Change versus the same elapsed time yesterday. Null when yesterday had no sales. */
    vsYesterdayPct: number | null;
    /** Sales per outlet-local hour, always 24 entries. */
    hourlyMinor: number[];
  };
  topSellers: Array<{ dishId: string; name: string; quantity: number; revenueMinor: number }>;
  /** Guests currently waiting: orders placed but not yet served or collected. */
  wait: { openOrders: number; averageMinutes: number | null; oldestMinutes: number | null };
  guests: { newGuests: number; returningGuests: number; ordersWithoutContact: number };
};

const EXCLUDED = sql`('cancelled','rejected','expired')`;
const OPEN = sql`('pending','accepted','preparing','ready')`;

export async function getTodayPulse(
  actor: Actor,
  outletId: string,
  timezone: string,
  currency: string,
  now = new Date()
): Promise<TodayPulse> {
  const today = outletDayParts(now, timezone);
  const yesterday = outletDayParts(now, timezone, -1);

  return withOutletRead(actor, outletId, "orders.read", async (tx) => {
    const todayFilter = reportOrderDateFilter("orders", today.date, today.date, timezone);
    const todayJoined = reportOrderDateFilter("joined", today.date, today.date, timezone);
    const yesterdayFilter = reportOrderDateFilter(
      "orders",
      yesterday.date,
      yesterday.date,
      timezone
    );
    const dayStart = sql`(${today.date}::date::timestamp at time zone ${timezone})`;

    const [hourly, baseline, sellers, open, guests, anonymous] = await Promise.all([
      tx.execute<{ hr: number; orders: number; sales: string }>(sql`
        select extract(hour from created_at at time zone ${timezone})::int as hr,
          count(*)::int as orders,
          coalesce(sum(total_minor), 0)::bigint::text as sales
        from orders
        where restaurant_id = ${outletId} and status not in ${EXCLUDED} and ${todayFilter}
        group by 1`),
      tx.execute<{ sales: string }>(sql`
        select coalesce(sum(total_minor), 0)::bigint::text as sales
        from orders
        where restaurant_id = ${outletId} and status not in ${EXCLUDED} and ${yesterdayFilter}
          and created_at < now() - interval '1 day'`),
      tx.execute<{ dish_id: string; item_name: string; quantity: number; revenue: string }>(sql`
        select oi.dish_id, max(oi.item_name) as item_name,
          sum(oi.quantity)::int as quantity,
          coalesce(sum(oi.total_minor), 0)::bigint::text as revenue
        from order_items oi
        join orders o on o.id = oi.order_id and o.restaurant_id = oi.restaurant_id
        where oi.restaurant_id = ${outletId} and o.status not in ${EXCLUDED} and ${todayJoined}
        group by oi.dish_id
        order by quantity desc, sum(oi.total_minor) desc, oi.dish_id
        limit 3`),
      tx.execute<{ open_orders: number; avg_s: number | null; oldest_s: number | null }>(sql`
        select count(*)::int as open_orders,
          avg(extract(epoch from now() - created_at))::float as avg_s,
          max(extract(epoch from now() - created_at))::float as oldest_s
        from orders
        where restaurant_id = ${outletId} and status in ${OPEN}
          and created_at > now() - interval '1 day'`),
      // A guest is "new" when their phone number has no earlier order at this outlet.
      tx.execute<{ total: number; fresh: number }>(sql`
        with todays as (
          select distinct customer_phone as phone from orders
          where restaurant_id = ${outletId} and status not in ${EXCLUDED} and ${todayFilter}
            and customer_phone is not null and customer_phone <> ''
        ), before as (
          select distinct customer_phone as phone from orders
          where restaurant_id = ${outletId} and status not in ${EXCLUDED}
            and created_at < ${dayStart}
            and customer_phone in (select phone from todays)
        )
        select (select count(*) from todays)::int as total,
          (select count(*) from todays where phone not in (select phone from before))::int as fresh`),
      tx.execute<{ n: number }>(sql`
        select count(*)::int as n from orders
        where restaurant_id = ${outletId} and status not in ${EXCLUDED} and ${todayFilter}
          and (customer_phone is null or customer_phone = '')`),
    ]);

    const hourlyMinor = Array.from({ length: 24 }, () => 0);
    let grossMinor = 0;
    let orders = 0;
    for (const row of hourly.rows) {
      if (row.hr >= 0 && row.hr < 24) hourlyMinor[row.hr] = Number(row.sales);
      grossMinor += Number(row.sales);
      orders += row.orders;
    }
    const o = open.rows[0];
    const g = guests.rows[0];
    const minutes = (s: number | null | undefined) =>
      s === null || s === undefined ? null : Math.max(0, Math.round(s / 60));

    return {
      currency,
      hour: today.hour,
      sales: {
        grossMinor,
        orders,
        aovMinor: orders > 0 ? Math.round(grossMinor / orders) : 0,
        vsYesterdayPct: percentChange(grossMinor, Number(baseline.rows[0]?.sales ?? 0)),
        hourlyMinor,
      },
      topSellers: sellers.rows.map((r) => ({
        dishId: r.dish_id,
        name: r.item_name,
        quantity: r.quantity,
        revenueMinor: Number(r.revenue),
      })),
      wait: {
        openOrders: o?.open_orders ?? 0,
        averageMinutes: minutes(o?.avg_s),
        oldestMinutes: minutes(o?.oldest_s),
      },
      guests: {
        newGuests: g?.fresh ?? 0,
        returningGuests: Math.max(0, (g?.total ?? 0) - (g?.fresh ?? 0)),
        ordersWithoutContact: anonymous.rows[0]?.n ?? 0,
      },
    };
  });
}
