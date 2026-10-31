import { z } from "zod";
import { searchFaqs, searchHelpArticles } from "@/content/help";
import {
  merchantReport,
  merchantFindDish,
  merchantImports,
  merchantQr,
  merchantQrDetails,
  merchantServiceRequests,
  merchantInsights,
  merchantBilling,
  merchantMyTickets,
  reportPeriods,
} from "./merchant-tools";
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
import { env } from "@/lib/config/env";
import { executeProposeTool, isProposeTool, proposeToolDefinitions } from "./propose-tools";
import { withActor, withOutletRead, type Actor } from "@/modules/tenancy/service";

/** Tool descriptions are authored server-side. No SQL, URLs or write tools exist here. */
export type ToolContext = {
  actor: Actor;
  organizationId: string;
  outletId: string;
  /** Present during a conversation turn; propose-only tools attach their pending request to it. */
  conversationId?: string;
};
const empty = z.object({}).strict();
const history = z
  .object({
    status: z
      .enum(["all", "completed", "cancelled", "served", "collected", "rejected", "expired"])
      .default("all"),
    page: z.number().int().min(0).max(2).default(0),
  })
  .strict();
// Defined once so execution never depends on its position in a registry.
const helpSearchTool = {
  name: "help.search",
  description:
    "Search authoritative MenuMinute how-to guides, setup instructions, and feature explanations for restaurant owners, kitchen staff, and diners.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        minLength: 2,
        maxLength: 80,
        description:
          "Feature or topic to look up (e.g. 'mark sold out', 'print QR', 'menu studio', 'kitchen display', 'table tabs')",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
  schema: z.object({ query: z.string().trim().min(2).max(80) }).strict(),
  run: async (_context: ToolContext, args: { query: string }) => {
    // Staff are restaurant-side users: owner guides plus shared ones, never diner-only pages.
    const results = searchHelpArticles(args.query, "owner");
    const faqs = searchFaqs(args.query).slice(0, 2);
    return {
      source: "help.knowledgeBase",
      data: {
        query: args.query,
        // Published Help Center answers: authoritative product facts (pricing, plans, limits).
        faqs: faqs.map((f) => ({
          question: f.question,
          answer: f.answer.slice(0, 600),
          category: f.category ?? "",
        })),
        matches: results.slice(0, 3).map((r) => ({
          title: r.article.title,
          slug: r.article.slug,
          audience: r.article.audience,
          category: r.article.category,
          summary: r.article.summary,
          quickSteps: r.article.quickSteps.slice(0, 4),
          dashboardLink: r.article.dashboardLink,
        })),
      },
    };
  },
};

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
    name: "tables.pulse",
    description:
      "Summarize orders-derived active tickets and unpaid balances across dining tables for the selected outlet. This is not a physical occupancy count.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => {
      const rows = await getOutletFloorMatrix(
        context.actor,
        context.organizationId,
        context.outletId
      );
      return {
        source: "hospitality.floorMatrix",
        data: {
          totalTables: rows.length,
          tablesWithActiveOrders: rows.filter((x) => x.activeOrders > 0).length,
          tablesWithUnpaidOrders: rows.filter((x) => x.unpaidOrders > 0).length,
          truncated: rows.length === 200,
        },
      };
    },
  },
  {
    name: "finance.pulse",
    description:
      "Read the draft POS register's recent order snapshots for the authorized outlet. These are not verified revenue, tender breakdowns or cash drawer balances.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => {
      await withOutletRead(context.actor, context.outletId, "billing.manage", async () => true);
      const workspace = await posWorkspace(context.actor, context.organizationId, context.outletId);
      return {
        source: "pos.draftRegister",
        data: {
          enabled: workspace.context.enabled,
          currency: workspace.context.currency,
          recentDrafts: workspace.recent.length,
          eligibleUnattachedTickets: workspace.attachable.length,
          revenueVerified: false,
          totalsOmitted: "Draft sale snapshots are not payments or settled revenue",
        },
      };
    },
  },
  {
    name: "reports.summary",
    description:
      "Read verified outlet-scoped report metrics and top-selling dishes for today, yesterday, this calendar week, seven days, thirty days or this month. Order values are not paid revenue; label operator-recorded payments separately.",
    parameters: {
      type: "object",
      properties: { range: { type: "string", enum: [...reportPeriods] } },
      required: ["range"],
      additionalProperties: false,
    },
    schema: z.object({ range: z.enum(reportPeriods) }).strict(),
    run: async (context: ToolContext, args: { range: (typeof reportPeriods)[number] }) =>
      merchantReport(context, args.range),
  },
  {
    name: "menu.findDish",
    description:
      "Search published outlet menu dishes by part of a dish name; answer whether the restaurant offers the item and show actual availability. Never use draft counts as proof that a dish is sold.",
    parameters: {
      type: "object",
      properties: { query: { type: "string", minLength: 2, maxLength: 80 } },
      required: ["query"],
      additionalProperties: false,
    },
    schema: z.object({ query: z.string().trim().min(2).max(80) }).strict(),
    run: async (context: ToolContext, args: { query: string }) =>
      merchantFindDish(context, args.query),
  },
  {
    name: "imports.pulse",
    description:
      "Read the latest private menu-import statuses for the selected outlet; no publication or editing.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => merchantImports(context),
  },
  {
    name: "qr.pulse",
    description: "Count active and total saved QR codes for the selected outlet, not QR scans.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => merchantQr(context),
  },
  {
    name: "service.requests",
    description:
      "List open guest requests at tables (call a server, water refill, bill request) with how long each has waited. Read-only.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => merchantServiceRequests(context),
  },
  {
    name: "qr.details",
    description:
      "Show the outlet's saved QR codes by name and table, whether each is active and how many times each was scanned. Never returns links or images.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => merchantQrDetails(context),
  },
  {
    name: "reports.insights",
    description:
      "Busiest hours, slow-selling dishes, category mix and average kitchen prep time for today, yesterday, this calendar week, seven days, thirty days or this month. Order values are not paid revenue.",
    parameters: {
      type: "object",
      properties: { range: { type: "string", enum: [...reportPeriods] } },
      required: ["range"],
      additionalProperties: false,
    },
    schema: z.object({ range: z.enum(reportPeriods) }).strict(),
    run: async (context: ToolContext, args: { range: (typeof reportPeriods)[number] }) =>
      merchantInsights(context, args.range),
  },
  {
    name: "billing.status",
    description:
      "Show which paid features (online ordering, kitchen screens) are active and the subscription status. Owners and administrators only. Plan information only.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => merchantBilling(context),
  },
  {
    name: "support.myTickets",
    description:
      "Show the person's own recent support requests, their progress and the latest reply from the support team. Read-only.",
    parameters: { type: "object", properties: {}, additionalProperties: false },
    schema: empty,
    run: async (context: ToolContext) => merchantMyTickets(context),
  },
  helpSearchTool,
] as const;
export type ReadToolName = (typeof readTools)[number]["name"];
export function toolDefinitions() {
  return readTools.map(({ name, description, parameters }) => ({ name, description, parameters }));
}
/** Filter the model-visible registry using current SQL permissions, not the browser role. */
export async function authorizedToolDefinitions(context: ToolContext) {
  const access = await withActor(context.actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${context.outletId},true)`);
    const response = await tx.execute<{
      menu: boolean;
      orders: boolean;
      billing: boolean;
      menuWrite: boolean;
    }>(
      sql`select app_private.can_outlet(${context.outletId},'menu.read') as menu,
        app_private.can_outlet(${context.outletId},'orders.read') as orders,
        app_private.can_outlet(${context.outletId},'billing.manage') as billing,
        app_private.can_outlet(${context.outletId},'menu.write') as "menuWrite"`
    );
    return response.rows[0];
  });
  const proposable = env.AI_ASSISTANT_ACTIONS_ENABLED
    ? (await proposeAccess(context, proposeToolDefinitions())).filter(
        (d) => d.name !== "propose.menuPublish" || env.AI_ASSISTANT_PUBLISH_ENABLED
      )
    : [];
  return [...toolDefinitions(), ...proposable].filter((definition) => {
    if (isProposeTool(definition.name)) return true;
    if (definition.name === "help.search") return true;
    if (["menu.summary", "menu.findDish", "qr.pulse"].includes(definition.name))
      return access?.menu === true;
    if (definition.name === "imports.pulse")
      return access?.menu === true && access?.menuWrite === true;
    if (definition.name === "finance.pulse" || definition.name === "billing.status")
      return access?.billing === true;
    if (definition.name === "qr.details") return access?.menu === true;
    if (definition.name === "support.myTickets")
      return access?.menu === true || access?.orders === true;
    if (definition.name === "reports.summary") return access?.orders === true;
    return access?.orders === true;
  });
}
/** Keep a propose tool only when the person holds at least one permission it may need. */
async function proposeAccess<T extends { permissions: string[] }>(context: ToolContext, defs: T[]) {
  const held = await withActor(context.actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${context.outletId},true)`);
    const all = [...new Set(defs.flatMap((d) => d.permissions))];
    const out = new Set<string>();
    for (const permission of all) {
      const r = await tx.execute<{ allowed: boolean }>(
        sql`select app_private.can_outlet(${context.outletId},${permission}) as allowed`
      );
      if (r.rows[0]?.allowed) out.add(permission);
    }
    return out;
  });
  return defs
    .filter((d) => d.permissions.some((p) => held.has(p)))
    .map(({ permissions: _p, ...rest }) => rest);
}
export async function executeReadTool(context: ToolContext, name: string, untrusted: unknown) {
  if (isProposeTool(name)) {
    if (!env.AI_ASSISTANT_ACTIONS_ENABLED) throw new Error("Unknown read-only tool");
    if (name === "propose.menuPublish" && !env.AI_ASSISTANT_PUBLISH_ENABLED)
      throw new Error("Unknown read-only tool");
    return executeProposeTool(context, name, untrusted);
  }
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
    case "reports.summary":
      return readTools[6].run(context, readTools[6].schema.parse(untrusted));
    case "menu.findDish":
      return readTools[7].run(context, readTools[7].schema.parse(untrusted));
    case "imports.pulse":
      empty.parse(untrusted);
      return readTools[8].run(context);
    case "qr.pulse":
      empty.parse(untrusted);
      return readTools[9].run(context);
    case "service.requests":
      empty.parse(untrusted);
      return readTools[10].run(context);
    case "qr.details":
      empty.parse(untrusted);
      return readTools[11].run(context);
    case "reports.insights":
      return readTools[12].run(context, readTools[12].schema.parse(untrusted));
    case "billing.status":
      empty.parse(untrusted);
      return readTools[13].run(context);
    case "support.myTickets":
      empty.parse(untrusted);
      return readTools[14].run(context);
    case "help.search":
      return helpSearchTool.run(context, helpSearchTool.schema.parse(untrusted));
    default:
      throw new Error("Unknown read-only tool");
  }
}
