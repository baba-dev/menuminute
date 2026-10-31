import { z } from "zod";
import { randomUUID } from "node:crypto";
import { staffServiceRequests, type GuestServiceRequest } from "@/modules/hospitality/service";
import { listOutletOrders } from "@/modules/orders/service";
import { kitchenSnapshot } from "@/modules/kitchen/service";
import { ForbiddenError } from "@/lib/errors";
import type { ToolContext } from "./read-tools";
import { actionRequestHistory, proposeAction } from "./action-requests";
import {
  describeChanges,
  diffMenus,
  editableMenus,
  findDraftDishes,
  formatMoney,
  introducesSafetyClaim,
  priceToMinor,
} from "./menu-actions";
import { SUPPORT_CATEGORIES, SUPPORT_PRIORITIES } from "@/modules/support/service";

/**
 * Propose-only tools. Running one stores a PENDING request for the signed-in person to confirm; it
 * never changes the restaurant. The model supplies human references (table, order number); the
 * server finds the real record, checks the next step is allowed, and builds the sentence shown on
 * the confirmation card. Payments, refunds, billing and staff access are intentionally absent.
 */
const SIGNAL = {
  call_server: "server call",
  water_refill: "water request",
  bill_request: "bill request",
} as const;
const SIGNAL_ARG = { server: "call_server", water: "water_refill", bill: "bill_request" } as const;
const empty = (reason: string) => ({
  source: "assistant.actionRequest",
  data: { prepared: false, reason },
});
const prepared = (summary: string, kind: string, id: string) => ({
  source: "assistant.actionRequest",
  data: { prepared: true, awaitingConfirmation: true, kind, summary, requestId: id },
});

const NEXT_ORDER_STEPS: Record<string, string[]> = {
  pending: ["accepted", "rejected"],
  accepted: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["cancelled", "served", "collected"],
};
const TARGET_WORDS: Record<string, string> = {
  accepted: "accepted",
  preparing: "being prepared",
  ready: "ready",
  served: "served",
  collected: "collected",
  rejected: "rejected",
  cancelled: "cancelled",
};

const guestRequestSchema = z
  .object({
    table: z.string().trim().min(1).max(20),
    action: z.enum(["acknowledge", "resolve"]),
    request: z.enum(["server", "water", "bill"]).optional(),
  })
  .strict();
const orderStatusSchema = z
  .object({
    orderNumber: z.number().int().min(1).max(99_999_999),
    targetStatus: z.enum([
      "accepted",
      "preparing",
      "ready",
      "served",
      "collected",
      "rejected",
      "cancelled",
    ]),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();
const kitchenTicketSchema = z
  .object({
    orderNumber: z.number().int().min(1).max(99_999_999),
    action: z.enum(["start", "complete"]),
    dish: z.string().trim().min(2).max(80).optional(),
  })
  .strict();

const supportTicketSchema = z
  .object({
    subject: z.string().trim().min(3).max(120),
    details: z.string().trim().min(1).max(2000),
    category: z.enum(SUPPORT_CATEGORIES).optional(),
    priority: z.enum(SUPPORT_PRIORITIES).optional(),
  })
  .strict();

const menuPriceSchema = z
  .object({
    dish: z.string().trim().min(2).max(80),
    newPrice: z.number().positive().max(10_000_000),
    menu: z.string().trim().min(1).max(80).optional(),
    confirmLargeChange: z.boolean().optional(),
  })
  .strict();
const menuDescriptionSchema = z
  .object({
    dish: z.string().trim().min(2).max(80),
    description: z.string().trim().min(1).max(500),
    menu: z.string().trim().min(1).max(80).optional(),
  })
  .strict();
const menuPublishSchema = z.object({ menu: z.string().trim().min(1).max(80).optional() }).strict();

const withConversation = (context: ToolContext) => {
  if (!context.conversationId) throw new ForbiddenError("Actions need an open conversation");
  return context.conversationId;
};

export const proposeTools = [
  {
    name: "propose.guestRequest",
    description:
      "Prepare (not perform) marking a guest's table request as seen or done, for the person to confirm. Use the table number as the guest sees it. Never claims the change is done.",
    parameters: {
      type: "object",
      properties: {
        table: { type: "string", maxLength: 20, description: "Table number or name, e.g. '5'" },
        action: { type: "string", enum: ["acknowledge", "resolve"] },
        request: { type: "string", enum: ["server", "water", "bill"] },
      },
      required: ["table", "action"],
      additionalProperties: false,
    },
    schema: guestRequestSchema,
    permissions: ["orders.accept", "orders.complete", "outlet.manage"],
    run: async (context: ToolContext, args: z.infer<typeof guestRequestSchema>) => {
      const conversationId = withConversation(context);
      const wanted = args.request ? SIGNAL_ARG[args.request] : null;
      const open = (
        await staffServiceRequests(context.actor, context.organizationId, context.outletId)
      )
        .filter((r) => r.tableNumber.trim().toLowerCase() === args.table.toLowerCase())
        .filter((r) =>
          args.action === "acknowledge" ? r.status === "requested" : r.status !== "resolved"
        )
        .filter((r) => !wanted || r.signal === wanted);
      if (!open.length)
        return empty(
          `There is no open request to ${args.action === "acknowledge" ? "mark as seen" : "close"} at table ${args.table}.`
        );
      if (open.length > 1)
        return empty(
          `Table ${args.table} has ${open.length} open requests (${[...new Set(open.map((r) => SIGNAL[r.signal]))].join(", ")}). Which one should I prepare?`
        );
      const r = open[0] as GuestServiceRequest;
      const summary =
        args.action === "acknowledge"
          ? `Mark table ${r.tableNumber}'s ${SIGNAL[r.signal]} as seen`
          : `Mark table ${r.tableNumber}'s ${SIGNAL[r.signal]} as done`;
      const row = await proposeAction(context, {
        conversationId,
        key: randomUUID(),
        kind:
          args.action === "acknowledge" ? "service_request.acknowledge" : "service_request.resolve",
        params: { requestId: r.id },
        expected: { status: r.status },
        summary,
      });
      return prepared(summary, row.kind, row.id);
    },
  },
  {
    name: "propose.orderStatus",
    description:
      "Prepare (not perform) moving an order to its next step (accepted, being prepared, ready, served or collected) or rejecting/cancelling it, for the person to confirm. Use the order number. Cannot take payment.",
    parameters: {
      type: "object",
      properties: {
        orderNumber: { type: "integer", minimum: 1 },
        targetStatus: {
          type: "string",
          enum: ["accepted", "preparing", "ready", "served", "collected", "rejected", "cancelled"],
        },
        reason: { type: "string", maxLength: 300 },
      },
      required: ["orderNumber", "targetStatus"],
      additionalProperties: false,
    },
    schema: orderStatusSchema,
    permissions: ["orders.accept", "orders.prepare", "orders.complete", "orders.cancel"],
    run: async (context: ToolContext, args: z.infer<typeof orderStatusSchema>) => {
      const conversationId = withConversation(context);
      const order = (
        await listOutletOrders(context.actor, context.outletId, "active", context.organizationId)
      ).find((o) => o.orderNumber === args.orderNumber);
      if (!order) return empty(`I couldn't find an active order #${args.orderNumber}.`);
      if (!(NEXT_ORDER_STEPS[order.status] ?? []).includes(args.targetStatus))
        return empty(
          `Order #${order.orderNumber} is ${order.status}, so it can't go straight to ${TARGET_WORDS[args.targetStatus]}.`
        );
      if (args.targetStatus === "served" && order.fulfillmentMode !== "dine_in")
        return empty(
          `Order #${order.orderNumber} is a pickup order, so it can be marked collected.`
        );
      if (args.targetStatus === "collected" && order.fulfillmentMode !== "pickup")
        return empty(`Order #${order.orderNumber} is a dine-in order, so it can be marked served.`);
      if (order.kitchenManaged && ["preparing", "ready"].includes(args.targetStatus))
        return empty(
          `Order #${order.orderNumber} is run by the kitchen screen, so the kitchen moves it forward.`
        );
      const mode = order.fulfillmentMode === "dine_in" ? "dine-in" : "pickup";
      const verb = ["rejected", "cancelled"].includes(args.targetStatus)
        ? args.targetStatus === "rejected"
          ? "Reject"
          : "Cancel"
        : "Mark";
      const summary =
        verb === "Mark"
          ? `Mark order #${order.orderNumber} (${mode}) as ${TARGET_WORDS[args.targetStatus]}`
          : `${verb} order #${order.orderNumber} (${mode})`;
      const row = await proposeAction(context, {
        conversationId,
        key: randomUUID(),
        kind: "order.transition",
        params: {
          orderId: order.id,
          targetStatus: args.targetStatus,
          expectedVersion: order.version,
          ...(args.reason ? { reason: args.reason } : {}),
        },
        expected: { status: order.status, version: order.version },
        summary,
      });
      return prepared(summary, row.kind, row.id);
    },
  },
  {
    name: "propose.kitchenTicket",
    description:
      "Prepare (not perform) starting or completing a kitchen ticket for an order, for the person to confirm. Use the order number and, if the order has several dishes, part of the dish name.",
    parameters: {
      type: "object",
      properties: {
        orderNumber: { type: "integer", minimum: 1 },
        action: { type: "string", enum: ["start", "complete"] },
        dish: { type: "string", maxLength: 80 },
      },
      required: ["orderNumber", "action"],
      additionalProperties: false,
    },
    schema: kitchenTicketSchema,
    permissions: ["orders.prepare"],
    run: async (context: ToolContext, args: z.infer<typeof kitchenTicketSchema>) => {
      const conversationId = withConversation(context);
      const snap = await kitchenSnapshot(context.actor, context.organizationId, context.outletId);
      const needs = args.action === "start" ? "queued" : "preparing";
      let tickets = snap.work.filter(
        (w) => w.orderNumber === args.orderNumber && w.status === needs
      );
      if (args.dish) {
        const q = args.dish.toLowerCase();
        tickets = tickets.filter((w) => w.dishName.toLowerCase().includes(q));
      }
      if (!tickets.length)
        return empty(
          `Order #${args.orderNumber} has no ticket waiting to be ${args.action === "start" ? "started" : "completed"}.`
        );
      if (tickets.length > 1)
        return empty(
          `Order #${args.orderNumber} has ${tickets.length} matching tickets (${tickets
            .slice(0, 4)
            .map((w) => w.dishName)
            .join(", ")}). Which dish?`
        );
      const t = tickets[0]!;
      const summary = `${args.action === "start" ? "Start" : "Complete"} ${t.quantity} × ${t.dishName} for order #${t.orderNumber}`;
      const row = await proposeAction(context, {
        conversationId,
        key: randomUUID(),
        kind: "kitchen.work",
        params: { workId: t.id, action: args.action, expectedVersion: t.version },
        expected: { status: t.status, version: t.version },
        summary,
      });
      return prepared(summary, row.kind, row.id);
    },
  },
  {
    name: "propose.supportTicket",
    description:
      "Prepare (not send) a support request to the MenuMinute team for the person to confirm. Use when they want to report a problem, get help from a person, or raise an issue. Write a short plain subject and put what they told you in the details.",
    parameters: {
      type: "object",
      properties: {
        subject: { type: "string", minLength: 3, maxLength: 120 },
        details: { type: "string", maxLength: 2000 },
        category: { type: "string", enum: [...SUPPORT_CATEGORIES] },
        priority: { type: "string", enum: [...SUPPORT_PRIORITIES] },
      },
      required: ["subject", "details"],
      additionalProperties: false,
    },
    schema: supportTicketSchema,
    permissions: ["orders.read", "menu.read"],
    run: async (context: ToolContext, args: z.infer<typeof supportTicketSchema>) => {
      const conversationId = withConversation(context);
      const subject = args.subject.replace(/\s+/g, " ");
      const summary = `Send to support: “${subject.length > 90 ? subject.slice(0, 89) + "…" : subject}”`;
      const row = await proposeAction(context, {
        conversationId,
        key: randomUUID(),
        kind: "support.ticket",
        params: {
          subject,
          details: args.details,
          category: args.category ?? "question",
          priority: args.priority ?? "normal",
        },
        summary,
      });
      return prepared(summary, row.kind, row.id);
    },
  },
  {
    name: "propose.menuPrice",
    description:
      "Prepare (not apply) a price change for one dish in the DRAFT menu, for the person to confirm. Give the dish name and the new price in normal currency units (e.g. 300). The change is not visible to guests until the menu is published. Set confirmLargeChange only if the person has clearly said the big change is intended.",
    parameters: {
      type: "object",
      properties: {
        dish: { type: "string", minLength: 2, maxLength: 80 },
        newPrice: { type: "number", exclusiveMinimum: 0 },
        menu: { type: "string", maxLength: 80 },
        confirmLargeChange: { type: "boolean" },
      },
      required: ["dish", "newPrice"],
      additionalProperties: false,
    },
    schema: menuPriceSchema,
    permissions: ["menu.write"],
    run: async (context: ToolContext, args: z.infer<typeof menuPriceSchema>) => {
      const conversationId = withConversation(context);
      const found = await findDraftDishes(context, args.dish, args.menu);
      if (!found.length)
        return empty(`I couldn't find a dish called “${args.dish}” in your menus.`);
      if (found.length > 1)
        return empty(
          `Several dishes match “${args.dish}”: ${found
            .slice(0, 4)
            .map((f) => `${f.dishName} (${f.menuName})`)
            .join(", ")}. Which one?`
        );
      const d = found[0]!;
      if (d.hasVariants)
        return empty(
          `${d.dishName} has size options, so its prices are best changed in Menu Studio.`
        );
      if (d.localPriceMinor !== null)
        return empty(
          `This outlet sells ${d.dishName} at a local price of ${formatMoney(d.localPriceMinor, d.currency)}, which overrides the menu price. Change that in Menu Studio.`
        );
      let minor: number;
      try {
        minor = priceToMinor(args.newPrice, d.currency);
      } catch (error) {
        return empty(error instanceof Error ? error.message : "That price isn't valid.");
      }
      if (minor === d.priceMinor)
        return empty(`${d.dishName} is already ${formatMoney(minor, d.currency)}.`);
      if (
        !args.confirmLargeChange &&
        d.priceMinor > 0 &&
        (minor > d.priceMinor * 3 || minor * 3 < d.priceMinor)
      )
        return empty(
          `That would change ${d.dishName} from ${formatMoney(d.priceMinor, d.currency)} to ${formatMoney(minor, d.currency)}, which is a big jump. Please confirm the new price is right.`
        );
      const summary = `Change ${d.dishName} from ${formatMoney(d.priceMinor, d.currency)} to ${formatMoney(minor, d.currency)} in the “${d.menuName}” draft`;
      const row = await proposeAction(context, {
        conversationId,
        key: randomUUID(),
        kind: "menu.price",
        params: {
          menuId: d.menuId,
          dishId: d.dishId,
          beforeMinor: d.priceMinor,
          priceMinor: minor,
          expectedRevision: d.revision,
        },
        expected: { revision: d.revision },
        summary,
      });
      return prepared(summary, row.kind, row.id);
    },
  },
  {
    name: "propose.menuDescription",
    description:
      "Prepare (not apply) a new description for one dish in the DRAFT menu, for the person to confirm. Use the person's own wording, lightly tidied. Never add allergen, dietary or nutrition claims. Not visible to guests until the menu is published.",
    parameters: {
      type: "object",
      properties: {
        dish: { type: "string", minLength: 2, maxLength: 80 },
        description: { type: "string", minLength: 1, maxLength: 500 },
        menu: { type: "string", maxLength: 80 },
      },
      required: ["dish", "description"],
      additionalProperties: false,
    },
    schema: menuDescriptionSchema,
    permissions: ["menu.write"],
    run: async (context: ToolContext, args: z.infer<typeof menuDescriptionSchema>) => {
      const conversationId = withConversation(context);
      const found = await findDraftDishes(context, args.dish, args.menu);
      if (!found.length)
        return empty(`I couldn't find a dish called “${args.dish}” in your menus.`);
      if (found.length > 1)
        return empty(
          `Several dishes match “${args.dish}”: ${found
            .slice(0, 4)
            .map((f) => `${f.dishName} (${f.menuName})`)
            .join(", ")}. Which one?`
        );
      const d = found[0]!;
      const next = args.description.replace(/\s+/g, " ").trim();
      if (next === d.description.trim())
        return empty(`${d.dishName} already has that description.`);
      if (introducesSafetyClaim(d.description, next))
        return empty(
          "I can't add allergen, dietary or nutrition details, because those must be checked by you. Please edit them in Menu Studio."
        );
      const summary = `Update the description of ${d.dishName} in the “${d.menuName}” draft`;
      const row = await proposeAction(context, {
        conversationId,
        key: randomUUID(),
        kind: "menu.description",
        params: {
          menuId: d.menuId,
          dishId: d.dishId,
          before: d.description,
          description: next,
          expectedRevision: d.revision,
        },
        expected: { revision: d.revision },
        summary,
      });
      return prepared(summary, row.kind, row.id);
    },
  },
  {
    name: "propose.menuPublish",
    description:
      "Prepare (not perform) publishing the DRAFT menu so guests see it, for the person to confirm. Use ONLY when the person explicitly asks to publish or make changes live. The confirmation card lists exactly what will change.",
    parameters: {
      type: "object",
      properties: { menu: { type: "string", maxLength: 80 } },
      additionalProperties: false,
    },
    schema: menuPublishSchema,
    permissions: ["menu.write"],
    run: async (context: ToolContext, args: z.infer<typeof menuPublishSchema>) => {
      const conversationId = withConversation(context);
      const pending = (await actionRequestHistory(context, conversationId)).filter((r) => {
        const row = r as { kind: string; status: string; expiresAt: string | Date };
        return (
          ["menu.price", "menu.description"].includes(row.kind) &&
          row.status === "pending" &&
          new Date(row.expiresAt).getTime() > Date.now()
        );
      });
      if (pending.length)
        return empty(
          "You still have a draft change waiting on a card above. Confirm or dismiss it first, then ask me to publish."
        );
      const menus = (await editableMenus(context, args.menu)).filter((m) => !m.archived);
      const visibleDishes = (m: (typeof menus)[number]) =>
        m.document.categories.reduce(
          (n, c) => n + (c.archived ? 0 : c.items.filter((i) => !i.archived).length),
          0
        );
      const changed = menus
        .map((m) => ({ m, changes: diffMenus(m.document, m.publishedDocument) }))
        // A never-published menu only counts once it has a dish; the database refuses an empty one.
        .filter((x) => (x.m.publishedDocument ? x.changes.length > 0 : visibleDishes(x.m) > 0));
      if (!changed.length)
        return empty("Everything is already published, so there is nothing to put live.");
      if (changed.length > 1)
        return empty(
          `More than one menu has unpublished changes (${changed
            .slice(0, 4)
            .map((x) => x.m.document.name)
            .join(", ")}). Which one should I publish?`
        );
      const { m, changes } = changed[0]!;
      const first = !m.publishedDocument;
      const dishes = visibleDishes(m);
      const lines = first ? [`First publish: ${dishes} dishes go live`] : changes;
      const summary = first
        ? `Publish “${m.document.name}” for the first time`
        : `Publish “${m.document.name}”: ${changes.length} ${changes.length === 1 ? "change goes" : "changes go"} live`;
      const row = await proposeAction(context, {
        conversationId,
        key: randomUUID(),
        kind: "menu.publish",
        params: { menuId: m.id, expectedRevision: m.revision },
        expected: { revision: m.revision, preview: describeChanges(lines) },
        summary,
      });
      return prepared(summary, row.kind, row.id);
    },
  },
] as const;

export type ProposeToolName = (typeof proposeTools)[number]["name"];
export const isProposeTool = (name: string): name is ProposeToolName =>
  proposeTools.some((t) => t.name === name);
export function proposeToolDefinitions() {
  return proposeTools.map(({ name, description, parameters, permissions }) => ({
    name,
    description,
    parameters,
    permissions: [...permissions],
  }));
}
export async function executeProposeTool(context: ToolContext, name: string, untrusted: unknown) {
  switch (name) {
    case "propose.guestRequest":
      return proposeTools[0].run(context, proposeTools[0].schema.parse(untrusted));
    case "propose.orderStatus":
      return proposeTools[1].run(context, proposeTools[1].schema.parse(untrusted));
    case "propose.kitchenTicket":
      return proposeTools[2].run(context, proposeTools[2].schema.parse(untrusted));
    case "propose.supportTicket":
      return proposeTools[3].run(context, proposeTools[3].schema.parse(untrusted));
    case "propose.menuPrice":
      return proposeTools[4].run(context, proposeTools[4].schema.parse(untrusted));
    case "propose.menuDescription":
      return proposeTools[5].run(context, proposeTools[5].schema.parse(untrusted));
    case "propose.menuPublish":
      return proposeTools[6].run(context, proposeTools[6].schema.parse(untrusted));
    default:
      throw new Error("Unknown action tool");
  }
}
