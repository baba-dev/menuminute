import { sql } from "drizzle-orm";
import { z } from "zod";
import { withActor, type Actor, type Permission } from "@/modules/tenancy/service";
import type { Transaction } from "@/db";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { staffServiceRequestAction } from "@/modules/hospitality/service";
import { transitionOutletOrder } from "@/modules/orders/service";
import { kitchenWorkCommand } from "@/modules/kitchen/service";
import { createSupportTicket, createTicketInput } from "@/modules/support/service";
import { assertAssistantScope, type Scope } from "./store";

/**
 * Confirm-first actions. The model (or a form) only PROPOSES a typed request; nothing changes until
 * the same signed-in person confirms it. Confirmation re-checks their current permission and runs
 * the existing domain command, which keeps its own authorization, state machine, optimistic
 * version and outbox. This module never writes business tables itself.
 */
const uuid = z.string().uuid();
const identity = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const ORDER_TARGETS = [
  "accepted",
  "preparing",
  "ready",
  "served",
  "collected",
  "rejected",
  "cancelled",
] as const;

type Kind =
  | "service_request.acknowledge"
  | "service_request.resolve"
  | "order.transition"
  | "kitchen.work"
  | "support.ticket";
type Definition<T extends z.ZodType> = {
  schema: T;
  /** Any one of these permissions lets the person propose and confirm; the domain re-checks. */
  permissions: (params: z.infer<T>) => Permission[];
  execute: (s: Scope, params: z.infer<T>, proposalId: string) => Promise<ExecutionOutcome>;
};
export type ExecutionOutcome =
  | { status: "confirmed"; message: string; detail?: Record<string, unknown> }
  | { status: "stale"; message: string }
  /** A refusal the person should read (for example "daily limit reached"); nothing was changed. */
  | { status: "failed"; message: string };

const requestParams = z.object({ requestId: uuid }).strict();
const orderParams = z
  .object({
    orderId: identity,
    targetStatus: z.enum(ORDER_TARGETS),
    expectedVersion: z.number().int().min(1),
    reason: z.string().trim().max(300).optional(),
  })
  .strict();
const kitchenParams = z
  .object({
    workId: identity,
    action: z.enum(["start", "complete"]),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();

const orderPermission = (target: (typeof ORDER_TARGETS)[number]): Permission =>
  target === "preparing"
    ? "orders.prepare"
    : ["ready", "served", "collected"].includes(target)
      ? "orders.complete"
      : ["rejected", "cancelled"].includes(target)
        ? "orders.cancel"
        : "orders.accept";

const STALE =
  "That changed before you confirmed, so nothing was changed. Ask me again for the latest.";
async function staleOnConflict(work: () => Promise<ExecutionOutcome>): Promise<ExecutionOutcome> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ConflictError || error instanceof NotFoundError)
      return { status: "stale", message: STALE };
    throw error;
  }
}

export const actionKinds: { [K in Kind]: Definition<z.ZodType> } = {
  "service_request.acknowledge": {
    schema: requestParams,
    permissions: () => ["orders.accept", "orders.complete", "outlet.manage"],
    execute: (s, p) =>
      staleOnConflict(async () => {
        const r = await staffServiceRequestAction(s.actor, s.organizationId, s.outletId, {
          requestId: (p as z.infer<typeof requestParams>).requestId,
          action: "acknowledge",
        });
        if (!r) throw new ConflictError("Request unavailable");
        return { status: "confirmed", message: "Marked as seen by staff." };
      }),
  },
  "service_request.resolve": {
    schema: requestParams,
    permissions: () => ["orders.accept", "orders.complete", "outlet.manage"],
    execute: (s, p) =>
      staleOnConflict(async () => {
        const r = await staffServiceRequestAction(s.actor, s.organizationId, s.outletId, {
          requestId: (p as z.infer<typeof requestParams>).requestId,
          action: "resolve",
        });
        if (!r) throw new ConflictError("Request unavailable");
        return { status: "confirmed", message: "Marked as done." };
      }),
  },
  "order.transition": {
    schema: orderParams,
    permissions: (p) => [orderPermission((p as z.infer<typeof orderParams>).targetStatus)],
    execute: (s, raw) =>
      staleOnConflict(async () => {
        const p = raw as z.infer<typeof orderParams>;
        const r = await transitionOutletOrder(
          s.actor,
          s.outletId,
          p.orderId,
          { targetStatus: p.targetStatus, expectedVersion: p.expectedVersion, reason: p.reason },
          s.organizationId
        );
        if (r.success === false || r.expired) return { status: "stale", message: STALE };
        return {
          status: "confirmed",
          message: "Order updated.",
          detail: { currentStatus: r.currentStatus ?? p.targetStatus },
        };
      }),
  },
  "kitchen.work": {
    schema: kitchenParams,
    permissions: () => ["orders.prepare"],
    execute: (s, raw, proposalId) =>
      staleOnConflict(async () => {
        const p = raw as z.infer<typeof kitchenParams>;
        const r = await kitchenWorkCommand(s.actor, s.organizationId, s.outletId, {
          workId: p.workId,
          action: p.action,
          expectedVersion: p.expectedVersion,
          // The request id is the idempotency key: a retried confirmation cannot run twice.
          key: proposalId,
        });
        return {
          status: "confirmed",
          message: p.action === "start" ? "Kitchen ticket started." : "Kitchen ticket completed.",
          detail: { status: r.status },
        };
      }),
  },
  "support.ticket": {
    schema: createTicketInput,
    permissions: () => ["orders.read", "menu.read"],
    execute: async (s, raw) => {
      try {
        const r = await createSupportTicket(s, raw, "ember");
        return {
          status: "confirmed",
          message: `Sent to support as ticket #${r.ticketNumber}. The team will reply here.`,
          detail: { ticketNumber: r.ticketNumber },
        };
      } catch (error) {
        if (error instanceof ValidationError || error instanceof ForbiddenError)
          return {
            status: "failed",
            message: error.message || "Support couldn't take that request.",
          };
        throw error;
      }
    },
  },
};

export const proposeActionInput = z
  .object({
    conversationId: uuid,
    key: uuid,
    kind: z.enum([
      "service_request.acknowledge",
      "service_request.resolve",
      "order.transition",
      "kitchen.work",
      "support.ticket",
    ]),
    params: z.record(z.string(), z.unknown()),
    expected: z.record(z.string(), z.unknown()).default({}),
    /** Plain-language sentence shown on the confirmation card; built by the server, not the client. */
    summary: z.string().trim().min(1).max(300),
  })
  .strict();
export const decideActionInput = z
  .object({ key: uuid, decision: z.enum(["confirm", "reject"]) })
  .strict();

function translate(error: unknown): never {
  const inner = error instanceof Error && error.cause ? error.cause : error;
  const code =
    typeof inner === "object" && inner !== null && "code" in inner ? inner.code : undefined;
  if (code === "42501") throw new ForbiddenError("You can no longer do this");
  if (code === "40001" || code === "23505")
    throw new ConflictError("This request expired or was already handled");
  if (code === "22023" || code === "23514" || code === "23503")
    throw new ValidationError("This request cannot be prepared right now");
  throw error;
}

/** First permission the person currently holds, so the SQL gate and domain check agree. */
async function allowedPermission(tx: Transaction, outletId: string, options: Permission[]) {
  for (const permission of options) {
    const r = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.can_outlet(${outletId},${permission}) as allowed`
    );
    if (r.rows[0]?.allowed) return permission;
  }
  throw new ForbiddenError("Your role cannot do this");
}
async function scopedTx<T>(s: Scope, work: (tx: Transaction) => Promise<T>) {
  await assertAssistantScope(s);
  try {
    return await withActor(s.actor, async (tx) => {
      await tx.execute(sql`select set_config('app.outlet_id',${s.outletId},true)`);
      return work(tx);
    });
  } catch (error) {
    translate(error);
  }
}

const proposalRow = z.object({
  id: uuid,
  status: z.enum(["pending", "confirming", "confirmed", "rejected", "stale", "failed"]),
  kind: z.string(),
  summary: z.string(),
  expiresAt: z.coerce.date(),
  result: z.unknown().nullable(),
});

export async function proposeAction(s: Scope, input: unknown) {
  const p = proposeActionInput.parse(input);
  const def = actionKinds[p.kind];
  const params = def.schema.parse(p.params) as Record<string, unknown>;
  return scopedTx(s, async (tx) => {
    const permission = await allowedPermission(tx, s.outletId, def.permissions(params));
    const r = await tx.execute<{ result: unknown }>(sql`select app_private.ai_propose_action(
      ${s.organizationId},${s.outletId},${p.conversationId},${p.kind},${JSON.stringify(params)}::jsonb,
      ${JSON.stringify(p.expected)}::jsonb,${p.summary},${permission},${p.key}::uuid) as result`);
    return proposalRow.parse(r.rows[0]?.result);
  });
}

type Claim =
  | { claimed: false; result: Record<string, unknown> }
  | { claimed: true; kind: Kind; params: unknown; expected: unknown; summary: string };

/**
 * Confirm or reject. Three short database steps with the domain command between them, never held
 * inside one transaction: (1) atomically claim, (2) run the domain command, (3) record the outcome.
 * A crash after step 2 is safe to retry with the same key: the domain command's own version check
 * or idempotency key prevents a second change, and a conflict is reported as "already changed".
 */
export async function decideAction(s: Scope, requestId: string, input: unknown) {
  uuid.parse(requestId);
  const d = decideActionInput.parse(input);
  const kindOf = await scopedTx(s, async (tx) => {
    const r = await tx.execute<{ kind: Kind; params: unknown }>(
      sql`select kind,params from assistant_action_requests where id=${requestId}::uuid
        and organization_id=${s.organizationId} and outlet_id=${s.outletId} and user_id=${s.actor.userId}`
    );
    if (!r.rows[0]) throw new NotFoundError("Request");
    return r.rows[0];
  });
  const def = actionKinds[kindOf.kind];
  if (!def) throw new ValidationError("Unknown action");
  const stored = def.schema.parse(kindOf.params) as Record<string, unknown>;
  const claim = await scopedTx(s, async (tx) => {
    const permission = await allowedPermission(tx, s.outletId, def.permissions(stored));
    const r = await tx.execute<{ result: Claim }>(sql`select app_private.ai_claim_action(
      ${s.organizationId},${s.outletId},${requestId}::uuid,${d.key}::uuid,${d.decision},${permission}) as result`);
    return r.rows[0]!.result;
  });
  if (!claim.claimed) return claim.result;

  let outcome: ExecutionOutcome | { status: "failed"; message: string };
  try {
    outcome = await def.execute(s, def.schema.parse(claim.params), requestId);
  } catch (error) {
    outcome = {
      status: "failed",
      message:
        error instanceof ForbiddenError
          ? "Your role can no longer do this, so nothing was changed."
          : "That could not be completed, so nothing was changed. Please try again.",
    };
  }
  return scopedTx(s, async (tx) => {
    const r = await tx.execute<{ result: Record<string, unknown> }>(
      sql`select app_private.ai_finish_action(${s.organizationId},${s.outletId},${requestId}::uuid,
        ${d.key}::uuid,${outcome.status},${JSON.stringify({
          message: outcome.message,
          ...("detail" in outcome && outcome.detail ? { detail: outcome.detail } : {}),
        })}::jsonb) as result`
    );
    return r.rows[0]!.result;
  });
}

export async function actionRequestHistory(s: Scope, conversationId: string) {
  uuid.parse(conversationId);
  return scopedTx(s, async (tx) => {
    const rows = await tx.execute(
      sql`select id,status,kind,summary,expires_at as "expiresAt",created_at as "createdAt",result,
        case when kind='support.ticket' then left(params->>'details',220) end as preview
        from assistant_action_requests where conversation_id=${conversationId}
        and organization_id=${s.organizationId} and outlet_id=${s.outletId} and user_id=${s.actor.userId}
        order by created_at desc,id desc limit 20`
    );
    return rows.rows;
  });
}
export type { Actor };
