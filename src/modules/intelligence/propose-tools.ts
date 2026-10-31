import { z } from "zod";
import { randomUUID } from "node:crypto";
import { staffServiceRequests, type GuestServiceRequest } from "@/modules/hospitality/service";
import { listOutletOrders } from "@/modules/orders/service";
import { kitchenSnapshot } from "@/modules/kitchen/service";
import { ForbiddenError } from "@/lib/errors";
import type { ToolContext } from "./read-tools";
import { proposeAction } from "./action-requests";
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
    default:
      throw new Error("Unknown action tool");
  }
}
