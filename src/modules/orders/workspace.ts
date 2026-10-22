import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { orderItems, orders, orderStatusEvents, restaurants, restaurantTables } from "@/db/schema";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import type { Transaction } from "@/db";
import type { OrderStatus } from "./contracts";
import { NotFoundError } from "@/lib/errors";

const active: OrderStatus[] = ["pending", "accepted", "preparing", "ready"];
const completed: OrderStatus[] = ["served", "collected"];
const stopped: OrderStatus[] = ["rejected", "cancelled", "expired"];

export const historyQuerySchema = z.object({
  status: z.enum(["all", "completed", "cancelled", "served", "collected", "rejected", "expired"]).default("all"),
  mode: z.enum(["all", "dine_in", "pickup"]).default("all"),
  payment: z.enum(["all", "unpaid", "paid", "voided"]).default("all"),
  search: z.string().trim().max(80).default(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(0).max(100).default(0),
}).strict().superRefine((value, ctx) => {
  for (const field of ["from", "to"] as const) {
    const date = value[field];
    if (date && (!Number.isFinite(Date.parse(date + "T00:00:00Z")) ||
      new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date)) {
      ctx.addIssue({ code: "custom", path: [field], message: "Invalid calendar date" });
    }
  }
  if (value.from && value.to && value.from > value.to)
    ctx.addIssue({ code: "custom", path: ["to"], message: "End date precedes start date" });
});
export type HistoryQuery = z.infer<typeof historyQuerySchema>;

async function verify(tx: Transaction, organizationId: string, outletId: string) {
  const [row] = await tx.select({ id: restaurants.id }).from(restaurants).where(and(
    eq(restaurants.id, outletId), eq(restaurants.organizationId, organizationId),
  )).limit(1);
  if (!row) throw new NotFoundError("Outlet");
}

async function decorate(tx: Transaction, outletId: string, rows: (typeof orders.$inferSelect)[]) {
  const ids = rows.map((row) => row.id);
  const tableIds = [...new Set(rows.flatMap((row) => row.tableId ? [row.tableId] : []))];
  const [items, tables, kitchen, allowed] = await Promise.all([
    ids.length ? tx.select().from(orderItems).where(and(
      eq(orderItems.restaurantId, outletId), inArray(orderItems.orderId, ids)
    )) : Promise.resolve([]),
    tableIds.length ? tx.select({
      id: restaurantTables.id, label: restaurantTables.label, number: restaurantTables.tableNumber,
    }).from(restaurantTables).where(and(
      eq(restaurantTables.restaurantId, outletId), inArray(restaurantTables.id, tableIds)
    )) : Promise.resolve([]),
    tx.execute<{ data: string[] }>(sql`select app_private.kitchen_managed_orders(${outletId}) as data`),
    tx.execute<{ accept: boolean; prepare: boolean; complete: boolean; cancel: boolean; payment: boolean }>(
      sql`select app_private.can_outlet(${outletId}, 'orders.accept') as accept,
        app_private.can_outlet(${outletId}, 'orders.prepare') as prepare,
        app_private.can_outlet(${outletId}, 'orders.complete') as complete,
        app_private.can_outlet(${outletId}, 'orders.cancel') as cancel,
        app_private.can_outlet(${outletId}, 'billing.manage') as payment`
    ),
  ]);
  const byOrder = new Map<string, typeof items>();
  for (const item of items) {
    const bucket = byOrder.get(item.orderId) ?? [];
    bucket.push(item);
    byOrder.set(item.orderId, bucket);
  }
  const byTable = new Map(tables.map((table) => [table.id, table.label || "Table " + table.number]));
  const managed = new Set(kitchen.rows[0]?.data ?? []);
  const p = allowed.rows[0];
  return rows.map((row) => ({
    id: row.id, restaurantId: row.restaurantId, orderNumber: row.orderNumber,
    tableId: row.tableId, servicePoint: row.tableId ? byTable.get(row.tableId) ?? "Table" : null,
    customerName: row.customerName, customerPhone: row.customerPhone,
    fulfillmentMode: row.fulfillmentMode, status: row.status, paymentStatus: row.paymentStatus,
    currency: row.currency, subtotalMinor: row.subtotalMinor, taxMinor: row.taxMinor,
    totalMinor: row.totalMinor, notes: row.notes, rejectionReason: row.rejectionReason,
    version: row.version, createdAt: row.createdAt, updatedAt: row.updatedAt,
    expiresAt: row.expiresAt, kitchenManaged: managed.has(row.id),
    canAccept: p?.accept === true, canPrepare: p?.prepare === true,
    canComplete: p?.complete === true, canCancel: p?.cancel === true,
    canManagePayment: p?.payment === true, items: byOrder.get(row.id) ?? [],
  }));
}

// Show oldest active tickets first; explicit overflow signals capacity rather than silently losing work.
export async function listServiceRail(actor: Actor, organizationId: string, outletId: string) {
  return withOutlet(actor, outletId, "orders.read", async (tx) => {
    await verify(tx, organizationId, outletId);
    const rows = await tx.select().from(orders).where(and(
      eq(orders.restaurantId, outletId), inArray(orders.status, active)
    )).orderBy(asc(orders.createdAt), asc(orders.id)).limit(401);
    return { orders: await decorate(tx, outletId, rows.slice(0, 400)), overflow: rows.length > 400 };
  });
}

// Aggregate from all authorized rows, never from the capped rail or history response.
export async function servicePulse(actor: Actor, organizationId: string, outletId: string) {
  return withOutlet(actor, outletId, "orders.read", async (tx) => {
    await verify(tx, organizationId, outletId);
    const result = await tx.execute<{
      pending: number; preparing: number; ready: number; active: number; completedToday: number;
    }>(sql`select
      count(*) filter (where o.status = 'pending')::int as pending,
      count(*) filter (where o.status in ('accepted','preparing'))::int as preparing,
      count(*) filter (where o.status = 'ready')::int as ready,
      count(*) filter (where o.status in ('pending','accepted','preparing','ready'))::int as active,
      count(*) filter (where o.status in ('served','collected')
        and coalesce(o.business_date, (o.created_at at time zone r.timezone)::date)
            = (now() at time zone r.timezone)::date)::int as "completedToday"
      from restaurants r left join orders o on o.restaurant_id = r.id
      where r.id = ${outletId} group by r.id`);
    return result.rows[0] ?? { pending: 0, preparing: 0, ready: 0, active: 0, completedToday: 0 };
  });
}

export async function listServiceHistory(
  actor: Actor, organizationId: string, outletId: string, query: HistoryQuery
) {
  return withOutlet(actor, outletId, "orders.read", async (tx) => {
    await verify(tx, organizationId, outletId);
    const statuses: OrderStatus[] = query.status === "all" ? [...completed, ...stopped] :
      query.status === "completed" ? completed : query.status === "cancelled" ? stopped : [query.status];
    const conditions = [
      eq(orders.restaurantId, outletId), inArray(orders.status, statuses),
      query.mode === "all" ? undefined : eq(orders.fulfillmentMode, query.mode),
      query.payment === "all" ? undefined : eq(orders.paymentStatus, query.payment),
    ];
    if (query.search) {
      if (/^\d{1,9}$/.test(query.search)) {
        conditions.push(or(
          eq(orders.orderNumber, Number(query.search)),
          ilike(orders.customerName, "%" + query.search + "%")
        ));
      } else {
        const pattern = query.search.replace(/[%_\\]/g, "\\$&");
        conditions.push(sql`${orders.customerName} ilike ${"%" + pattern + "%"} escape '\'`);
      }
    }
    const businessDay = sql`coalesce(${orders.businessDate},
      (${orders.createdAt} at time zone (select timezone from restaurants where id = ${outletId}))::date)`;
    if (query.from) conditions.push(sql`${businessDay} >= ${query.from}::date`);
    if (query.to) conditions.push(sql`${businessDay} <= ${query.to}::date`);
    const predicate = and(...conditions);
    const [rows, counts] = await Promise.all([
      tx.select().from(orders).where(predicate).orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(26).offset(query.page * 25),
      tx.select({ count: sql<number>`count(*)::int` }).from(orders).where(predicate),
    ]);
    return { orders: await decorate(tx, outletId, rows.slice(0, 25)),
      total: counts[0]?.count ?? 0, page: query.page, hasMore: rows.length > 25 };
  });
}

export async function serviceOrderActivity(
  actor: Actor, organizationId: string, outletId: string, orderId: string
) {
  return withOutlet(actor, outletId, "orders.read", async (tx) => {
    await verify(tx, organizationId, outletId);
    const [order] = await tx.select({ id: orders.id }).from(orders).where(and(
      eq(orders.restaurantId, outletId), eq(orders.id, orderId)
    )).limit(1);
    if (!order) throw new NotFoundError("Order");
    const events = await tx.select({
      id: orderStatusEvents.id, fromStatus: orderStatusEvents.fromStatus,
      toStatus: orderStatusEvents.toStatus, note: orderStatusEvents.note,
      actorType: orderStatusEvents.actorType, createdAt: orderStatusEvents.createdAt,
    }).from(orderStatusEvents).where(and(
      eq(orderStatusEvents.restaurantId, outletId), eq(orderStatusEvents.orderId, orderId)
    )).orderBy(desc(orderStatusEvents.createdAt), desc(orderStatusEvents.id)).limit(60);
    return { events: events.reverse(), truncated: events.length === 60 };
  });
}
