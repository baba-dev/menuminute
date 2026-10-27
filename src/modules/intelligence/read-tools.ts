import { z } from "zod";
import { sql } from "drizzle-orm";
import { servicePulse, listServiceHistory, historyQuerySchema } from "@/modules/orders/workspace";
import { kitchenSnapshot } from "@/modules/kitchen/service";
import { kitchenPulse } from "@/modules/kitchen/presentation";
import { getRestaurantById } from "@/modules/restaurants/service";
import { getOutletFloorMatrix } from "@/modules/hospitality/floor-matrix";
import { posWorkspace } from "@/modules/pos/service";
import { listMenus } from "@/modules/menu-product/service";
import { menuDocumentSchema } from "@/modules/menu-product/contracts";
import { NotFoundError } from "@/lib/errors";
import { withActor, withOutletRead, type Actor } from "@/modules/tenancy/service";

/** Tool descriptions are authored server-side. No SQL, URLs or write tools exist here. */
export type ToolContext = { actor: Actor; organizationId: string; outletId: string };
const empty = z.object({}).strict();
const history = z
  .object({
    status: z
      .enum(["all", "completed", "cancelled", "served", "collected", "rejected", "expired"])
      .default("all"),
    page: z.number().int().min(0).max(2).default(0),
  })
  .strict();
export const readTools = [
  {
    name: "orders.pulse",
    description:
      "Read authoritative current order-status counts and today's completed orders for the selected outlet, in its business timezone. No finance or customer data.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => ({
      source: "orders.servicePulse",
      data: await servicePulse(context.actor, context.organizationId, context.outletId),
    }),
  },
  {
    name: "orders.history",
    description:
      "Read at most 10 recent completed or cancelled tickets for the selected outlet. This excludes contact information, customer names, notes and item details; amounts are order snapshots, not settled revenue.",
    parameters: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "completed", "cancelled", "served", "collected", "rejected", "expired"],
        },
        page: { type: "integer", minimum: 0, maximum: 2 },
      },
      additionalProperties: false,
    },
    schema: history,
    run: async (context: ToolContext, args: z.infer<typeof history>) => {
      const query = historyQuerySchema.parse({ status: args.status, page: args.page });
      const data = await listServiceHistory(
        context.actor,
        context.organizationId,
        context.outletId,
        query
      );
      return {
        source: "orders.listServiceHistory",
        data: {
          total: data.total,
          page: data.page,
          hasMore: data.hasMore,
          orders: data.orders.slice(0, 10).map((order) => ({
            orderNumber: order.orderNumber,
            status: order.status,
            fulfillmentMode: order.fulfillmentMode,
            currency: order.currency,
            totalMinor: order.totalMinor,
            createdAt: order.createdAt,
          })),
          truncated: data.orders.length > 10 || data.hasMore,
        },
      };
    },
  },
  {
    name: "kitchen.pulse",
    description:
      "Summarize only authorized, currently visible kitchen work. No station notes, diner details or preparation commands.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => {
      const snapshot = await kitchenSnapshot(
        context.actor,
        context.organizationId,
        context.outletId
      );
      return {
        source: "kitchen.kitchenSnapshot",
        data: {
          enabled: snapshot.enabled,
          workOverflow: snapshot.workOverflow,
          counts: kitchenPulse(snapshot.work),
        },
      };
    },
  },
  {
    name: "menu.summary",
    description:
      "Summarize at most 20 accessible menu drafts and their draft category/item counts, publication revision and currency for the selected outlet. These are NOT current public menu availability or sales.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => {
      const outlet = await getRestaurantById(context.actor, context.outletId);
      if (!outlet || outlet.organizationId !== context.organizationId)
        throw new NotFoundError("Outlet");
      const rows = await listMenus(context.actor, context.outletId);
      return {
        source: "menu.listMenus",
        data: {
          total: rows.length,
          truncated: rows.length > 20,
          menus: rows.slice(0, 20).map((row) => {
            const parsed = menuDocumentSchema.safeParse(row.document);
            return {
              id: row.id,
              revision: row.revision,
              publishedRevision: row.publishedRevision,
              archived: row.archived,
              updatedAt: row.updatedAt,
              ...(parsed.success
                ? {
                    name: parsed.data.name,
                    currency: parsed.data.currency,
                    draftCategories: parsed.data.categories.filter((c) => !c.archived).length,
                    draftDishes: parsed.data.categories
                      .filter((c) => !c.archived)
                      .reduce((n, c) => n + c.items.filter((d) => !d.archived).length, 0),
                  }
                : { documentUnavailable: true }),
            };
          }),
        },
      };
    },
  },
  {
    name:"tables.pulse",
    description:"Summarize orders-derived active tickets and unpaid balances across dining tables for the selected outlet. This is not a physical occupancy count.",
    parameters:{type:"object",properties:{},additionalProperties:false},
    schema:empty,
    run:async(context:ToolContext)=>{
      const rows=await getOutletFloorMatrix(context.actor,context.organizationId,context.outletId);
      return {source:"hospitality.floorMatrix",data:{
        totalTables:rows.length,
        tablesWithActiveOrders:rows.filter(x=>x.activeOrders>0).length,
        tablesWithUnpaidOrders:rows.filter(x=>x.unpaidOrders>0).length,
        truncated:rows.length===200,
      }};
    },
  },
  {
    name:"finance.pulse",
    description:"Read the draft POS register's recent order snapshots for the authorized outlet. These are not verified revenue, tender breakdowns or cash drawer balances.",
    parameters:{type:"object",properties:{},additionalProperties:false},
    schema:empty,
    run:async(context:ToolContext)=>{
      await withOutletRead(context.actor,context.outletId,"billing.manage",async()=>true);
      const workspace=await posWorkspace(context.actor,context.organizationId,context.outletId);
      return {source:"pos.draftRegister",data:{
        enabled:workspace.context.enabled,
        currency:workspace.context.currency,
        recentDrafts:workspace.recent.length,
        eligibleUnattachedTickets:workspace.attachable.length,
        revenueVerified:false,
        totalsOmitted:"Draft sale snapshots are not payments or settled revenue",
      }};
    },
  },
] as const;
export type ReadToolName = (typeof readTools)[number]["name"];
export function toolDefinitions() {
  return readTools.map(({ name, description, parameters }) => ({ name, description, parameters }));
}
/** Filter the model-visible registry using current SQL permissions, not the browser role. */
export async function authorizedToolDefinitions(context: ToolContext) {
  const access = await withActor(context.actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${context.outletId},true)`);
    const response = await tx.execute<{ menu: boolean; orders: boolean; billing: boolean }>(
      sql`select app_private.can_outlet(${context.outletId},'menu.read') as menu,
        app_private.can_outlet(${context.outletId},'orders.read') as orders,
        app_private.can_outlet(${context.outletId},'billing.manage') as billing`
    );
    return response.rows[0];
  });
  return toolDefinitions().filter((definition) => {
    if (definition.name === "menu.summary") return access?.menu === true;
    if (definition.name === "finance.pulse") return access?.billing === true;
    return access?.orders === true;
  });
}
export async function executeReadTool(context: ToolContext, name: string, untrusted: unknown) {
  // Deliberately dispatch individually so TypeScript and Zod validate each handler.
  switch (name) {
    case "orders.pulse":
      empty.parse(untrusted);
      return readTools[0].run(context);
    case "orders.history":
      return readTools[1].run(context, history.parse(untrusted));
    case "kitchen.pulse":
      empty.parse(untrusted);
      return readTools[2].run(context);
    case "menu.summary":
      empty.parse(untrusted);
      return readTools[3].run(context);
    case "tables.pulse":
      empty.parse(untrusted);
      return readTools[4].run(context);
    case "finance.pulse":
      empty.parse(untrusted);
      return readTools[5].run(context);
    default:
      throw new Error("Unknown read-only tool");
  }
}
