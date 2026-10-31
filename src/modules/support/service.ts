import { sql } from "drizzle-orm";
import { z } from "zod";
import { adminAuditLogs } from "@/db/schema";
import type { Transaction } from "@/db";
import type { AdminActor } from "@/lib/admin-guard";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
import { withActor, type Actor } from "@/modules/tenancy/service";

/**
 * Support desk. Operators raise requests (usually through Ember); platform admins work them.
 * Every write is one SECURITY DEFINER function (see migration 0066); this module only validates
 * input, shapes rows and, for admin writes, records the admin audit entry in the same transaction.
 */
export const SUPPORT_CATEGORIES = [
  "question",
  "bug",
  "billing",
  "menu",
  "orders",
  "kitchen",
  "other",
] as const;
export const SUPPORT_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export const SUPPORT_STATUSES = ["open", "in_progress", "waiting", "resolved", "closed"] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

const text = (min: number, max: number) =>
  z
    .string()
    // Plain text only: drop control characters, keep line breaks and tabs.
    .transform((v) => v.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim())
    .pipe(z.string().min(min).max(max));
export const createTicketInput = z
  .object({
    subject: text(3, 120),
    details: text(1, 4000),
    category: z.enum(SUPPORT_CATEGORIES).default("question"),
    priority: z.enum(SUPPORT_PRIORITIES).default("normal"),
  })
  .strict();
export type CreateTicketInput = z.input<typeof createTicketInput>;

export type TicketRow = {
  id: string;
  number: number;
  subject: string;
  status: SupportStatus;
  priority: SupportPriority;
  category: SupportCategory;
  requesterName: string;
  requesterEmail: string;
  organizationName: string;
  outletName: string;
  assigneeId: string | null;
  assigneeName: string | null;
  source: "ember" | "app";
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};
export type TicketMessage = {
  id: string;
  authorName: string;
  internal: boolean;
  body: string;
  createdAt: string;
};
export type TicketDetail = TicketRow & { body: string; messages: TicketMessage[] };

function translate(error: unknown): never {
  const inner = error instanceof Error && error.cause ? error.cause : error;
  const code =
    typeof inner === "object" && inner !== null && "code" in inner ? inner.code : undefined;
  const message = inner instanceof Error ? inner.message : "";
  if (code === "42501") throw new ForbiddenError(message.includes("demo") ? message : undefined);
  if (code === "22023") throw new ValidationError(message || "Invalid support request");
  if (code === "40001" || code === "23505") throw new ConflictError("Please try again");
  throw error;
}
async function run<T>(actor: Actor, work: (tx: Transaction) => Promise<T>) {
  try {
    return await withActor(actor, work);
  } catch (error) {
    translate(error);
  }
}

/* ───────────────────────── Operator side ───────────────────────── */

export async function createSupportTicket(
  s: { actor: Actor; organizationId: string; outletId: string },
  raw: unknown,
  source: "ember" | "app" = "ember"
) {
  const input = createTicketInput.parse(raw);
  return run(s.actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${s.outletId},true)`);
    const r = await tx.execute<{ result: { id: string; ticketNumber: number; status: string } }>(
      sql`select app_private.support_create_ticket(${s.organizationId},${s.outletId},${input.subject},
        ${input.details},${input.category},${input.priority},${source}) as result`
    );
    return r.rows[0]!.result;
  });
}

export type MyTicket = {
  number: number;
  subject: string;
  status: SupportStatus;
  createdAt: string;
  latestReply: { body: string; at: string } | null;
};
/** The signed-in person's own recent tickets with the latest reply they are allowed to see. */
export async function listMySupportTickets(actor: Actor, limit = 5): Promise<MyTicket[]> {
  return run(actor, async (tx) => {
    const r = await tx.execute<{
      number: number;
      subject: string;
      status: SupportStatus;
      createdAt: string;
      replyBody: string | null;
      replyAt: string | null;
    }>(sql`select t.ticket_number as number,t.subject,t.status,t.created_at as "createdAt",
      m.body as "replyBody",m.created_at as "replyAt"
      from support_tickets t left join lateral (
        select body,created_at from support_ticket_messages
        where ticket_id=t.id and not internal order by created_at desc,id desc limit 1
      ) m on true
      where t.requester_id=${actor.userId} and t.archived_at is null
      order by t.created_at desc,t.id desc limit ${Math.min(Math.max(limit, 1), 10)}`);
    return r.rows.map((x) => ({
      number: x.number,
      subject: x.subject,
      status: x.status,
      createdAt: new Date(x.createdAt).toISOString(),
      latestReply:
        x.replyBody && x.replyAt
          ? { body: x.replyBody.slice(0, 400), at: new Date(x.replyAt).toISOString() }
          : null,
    }));
  });
}

/* ───────────────────────── Admin side ───────────────────────── */

const adminActor = (a: AdminActor): Actor => ({ userId: a.id, sessionId: a.sessionId });
export const PAGE_SIZE = 25;
export const listFilters = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    priority: z.enum(SUPPORT_PRIORITIES).optional(),
    q: z.string().trim().max(80).optional(),
    archived: z.boolean().default(false),
    page: z.number().int().min(1).max(1000).default(1),
  })
  .strict();
export type ListFilters = z.input<typeof listFilters>;

const likeEscape = (v: string) => v.replace(/[\\%_]/g, (c) => "\\" + c);
const rowSelect = sql`t.id,t.ticket_number as number,t.subject,t.status,t.priority,t.category,
  t.requester_name as "requesterName",t.requester_email as "requesterEmail",
  t.organization_name as "organizationName",t.outlet_name as "outletName",
  t.assignee_id as "assigneeId",a.name as "assigneeName",t.source,
  (t.archived_at is not null) as archived,t.created_at as "createdAt",t.updated_at as "updatedAt"`;
type RawRow = Omit<TicketRow, "createdAt" | "updatedAt"> & {
  createdAt: string | Date;
  updatedAt: string | Date;
};
const shape = (r: RawRow): TicketRow => ({
  ...r,
  createdAt: new Date(r.createdAt).toISOString(),
  updatedAt: new Date(r.updatedAt).toISOString(),
});

/** One indexed read for the page (fetches one extra row to know whether a next page exists) and one grouped count. */
export async function adminListTickets(actor: AdminActor, raw: ListFilters = {}) {
  const f = listFilters.parse(raw);
  const q = f.q?.trim();
  const search = q
    ? sql`and (t.subject ilike ${"%" + likeEscape(q) + "%"} or t.requester_name ilike ${"%" + likeEscape(q) + "%"}
        or t.requester_email ilike ${"%" + likeEscape(q) + "%"} or t.organization_name ilike ${"%" + likeEscape(q) + "%"}
        ${/^#?\d{1,9}$/.test(q) ? sql`or t.ticket_number=${Number(q.replace("#", ""))}` : sql``})`
    : sql``;
  return run(adminActor(actor), async (tx) => {
    const [rows, counts] = await Promise.all([
      tx.execute<RawRow>(sql`select ${rowSelect} from support_tickets t left join users a on a.id=t.assignee_id
        where ${f.archived ? sql`t.archived_at is not null` : sql`t.archived_at is null`}
        ${f.status ? sql`and t.status=${f.status}` : sql``}
        ${f.priority ? sql`and t.priority=${f.priority}` : sql``} ${search}
        order by t.created_at desc,t.id desc limit ${PAGE_SIZE + 1} offset ${(f.page - 1) * PAGE_SIZE}`),
      tx.execute<{ status: SupportStatus; n: number }>(
        sql`select status,count(*)::int as n from support_tickets where archived_at is null group by status`
      ),
    ]);
    const byStatus = Object.fromEntries(SUPPORT_STATUSES.map((s) => [s, 0])) as Record<
      SupportStatus,
      number
    >;
    for (const c of counts.rows) byStatus[c.status] = c.n;
    return {
      tickets: rows.rows.slice(0, PAGE_SIZE).map(shape),
      hasNext: rows.rows.length > PAGE_SIZE,
      page: f.page,
      counts: { ...byStatus, all: Object.values(byStatus).reduce((a, b) => a + b, 0) },
    };
  });
}

export async function adminTicketDetail(actor: AdminActor, id: string): Promise<TicketDetail> {
  z.string().uuid().parse(id);
  return run(adminActor(actor), async (tx) => {
    const t = await tx.execute<RawRow & { body: string }>(
      sql`select ${rowSelect},t.body from support_tickets t left join users a on a.id=t.assignee_id where t.id=${id}::uuid`
    );
    if (!t.rows[0]) throw new NotFoundError("Ticket");
    const m = await tx.execute<{
      id: string;
      authorName: string;
      internal: boolean;
      body: string;
      createdAt: string | Date;
    }>(sql`select id,author_name as "authorName",internal,body,created_at as "createdAt"
      from support_ticket_messages where ticket_id=${id}::uuid order by created_at,id limit 200`);
    return {
      ...shape(t.rows[0]),
      body: t.rows[0].body,
      messages: m.rows.map((x) => ({ ...x, createdAt: new Date(x.createdAt).toISOString() })),
    };
  });
}

async function audit(
  tx: Transaction,
  actor: AdminActor,
  action: string,
  id: string,
  details: Record<string, unknown>
) {
  let ip = "unknown";
  let agent = "unknown";
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    ip = h.get("x-forwarded-for") || h.get("x-real-ip") || "unknown";
    agent = h.get("user-agent") || "unknown";
  } catch {
    /* outside a request (tests) */
  }
  await tx.insert(adminAuditLogs).values({
    id: crypto.randomUUID(),
    actorId: actor.id,
    actorEmail: actor.email,
    action,
    targetType: "support_ticket",
    targetId: id,
    details,
    ipAddress: ip,
    userAgent: agent,
  });
}

export const updateInput = z
  .object({
    status: z.enum(SUPPORT_STATUSES).optional(),
    priority: z.enum(SUPPORT_PRIORITIES).optional(),
    assign: z.enum(["me", "none"]).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to update");
export async function adminUpdateTicket(actor: AdminActor, id: string, raw: unknown) {
  z.string().uuid().parse(id);
  const p = updateInput.parse(raw);
  return run(adminActor(actor), async (tx) => {
    const r = await tx.execute<{ result: Record<string, unknown> }>(
      sql`select app_private.support_admin_update(${id}::uuid,${p.status ?? null},${p.priority ?? null},
        ${p.assign === "me" ? actor.id : null},${p.assign === "none"}) as result`
    );
    await audit(tx, actor, "support.update", id, p);
    return r.rows[0]!.result;
  });
}

export const replyInput = z
  .object({
    body: text(1, 4000),
    internal: z.boolean().default(false),
    status: z.enum(SUPPORT_STATUSES).optional(),
  })
  .strict();
export async function adminReplyTicket(actor: AdminActor, id: string, raw: unknown) {
  z.string().uuid().parse(id);
  const p = replyInput.parse(raw);
  return run(adminActor(actor), async (tx) => {
    const r = await tx.execute<{ result: Record<string, unknown> }>(
      sql`select app_private.support_admin_reply(${id}::uuid,${p.body},${p.internal},${p.status ?? null}) as result`
    );
    // The audit trail records that a reply happened, never its text.
    await audit(tx, actor, p.internal ? "support.note" : "support.reply", id, {
      status: p.status ?? null,
    });
    return r.rows[0]!.result;
  });
}

export async function adminArchiveTicket(actor: AdminActor, id: string, archived: boolean) {
  z.string().uuid().parse(id);
  return run(adminActor(actor), async (tx) => {
    const r = await tx.execute<{ result: Record<string, unknown> }>(
      sql`select app_private.support_admin_archive(${id}::uuid,${archived}) as result`
    );
    await audit(tx, actor, archived ? "support.archive" : "support.restore", id, {});
    return r.rows[0]!.result;
  });
}
