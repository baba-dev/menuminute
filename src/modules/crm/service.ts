import { sql } from "drizzle-orm";
import { z } from "zod";
import { ForbiddenError } from "@/lib/errors";
import { redisClient } from "@/lib/redis";
import { withOutlet, withOutletRead, type Actor } from "@/modules/tenancy/service";

/** Merchant-only CRM. Every call verifies the outlet/organization and paid entitlement in SQL. */
const ident = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const search = z.string().trim().max(80);
const phone = z.string().trim().min(8).max(32);
const page = z.number().int().min(0).max(1000);
const save = z
  .object({
    id: ident.nullable().default(null),
    phone: z.string().max(32).default(""),
    name: z.string().trim().max(80).default(""),
    notes: z.string().trim().max(1000).default(""),
  })
  .strict();

export type GuestMatch = {
  id: string;
  name: string;
  phone: string;
  visits: number;
  lastVisit: string | null;
};
export type GuestList = { total: number; items: GuestMatch[] };
export type GuestDetail = {
  id: string;
  name: string;
  phone: string;
  notes: string;
  marketingConsent: boolean;
  orders: Array<{
    id: string;
    number: number;
    createdAt: string;
    status: string;
    paymentStatus: string;
    currency: string;
    totalMinor: string;
  }>;
};

async function scoped<T>(
  actor: Actor,
  organizationId: string,
  outletId: string,
  permission: "orders.read" | "orders.accept" | "outlet.manage",
  work: (run: (query: ReturnType<typeof sql>) => Promise<{ rows: unknown[] }>) => Promise<T>
): Promise<T> {
  ident.parse(organizationId);
  ident.parse(outletId);
  const fn = permission === "orders.read" ? withOutletRead : withOutlet;
  return fn(actor, outletId, permission, async (tx) => {
    const check = await tx.execute<{ organizationId: string }>(
      sql`select organization_id as "organizationId" from restaurants where id=${outletId}`
    );
    if (check.rows[0]?.organizationId !== organizationId) throw new ForbiddenError();
    return work((query) => tx.execute(query) as Promise<{ rows: unknown[] }>);
  });
}

/** Distributed per-session budget for personally identifiable lookups. */
async function lookupBudget(actor: Actor, outletId: string) {
  const redis = await redisClient("cache");
  const key = "crm:lookup:" + actor.userId + ":" + outletId;
  const n = await redis.eval(
    "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],60) end; return n",
    { keys: [key], arguments: [] }
  );
  if (Number(n) > 90) throw new ForbiddenError("Too many guest lookups. Try again shortly.");
}

export async function lookupGuest(actor: Actor, org: string, outlet: string, raw: string) {
  const number = phone.parse(raw);
  await lookupBudget(actor, outlet);
  return scoped(actor, org, outlet, "orders.read", async (run) => {
    const r = await run(sql`select app_private.crm_lookup(${outlet},${number}) as data`);
    return (r.rows[0] as { data: GuestMatch | null } | undefined)?.data ?? null;
  });
}
export async function listGuests(
  actor: Actor,
  org: string,
  outlet: string,
  query: string,
  offsetPage: number
): Promise<GuestList> {
  const q = search.parse(query);
  const p = page.parse(offsetPage);
  return scoped(actor, org, outlet, "orders.read", async (run) => {
    const r = await run(sql`select app_private.crm_list(${outlet},${q},${p}) as data`);
    return (r.rows[0] as { data: GuestList } | undefined)?.data ?? { total: 0, items: [] };
  });
}
export async function guestDetail(actor: Actor, org: string, outlet: string, guestId: string) {
  const id = ident.parse(guestId);
  return scoped(actor, org, outlet, "orders.read", async (run) => {
    const r = await run(sql`select app_private.crm_detail(${outlet},${id}) as data`);
    return (r.rows[0] as { data: GuestDetail | null } | undefined)?.data ?? null;
  });
}
export async function saveGuest(actor: Actor, org: string, outlet: string, raw: unknown) {
  const input = save.parse(raw);
  return scoped(actor, org, outlet, "orders.accept", async (run) => {
    const r = await run(sql`select app_private.crm_save(${outlet},${input.id},
      ${input.phone},${input.name},${input.notes}) as data`);
    return (r.rows[0] as { data: GuestMatch }).data;
  });
}
export async function eraseGuest(actor: Actor, org: string, outlet: string, idRaw: unknown) {
  const id = ident.parse(idRaw);
  return scoped(actor, org, outlet, "outlet.manage", async (run) => {
    const r = await run(sql`select app_private.crm_erase(${outlet},${id}) as erased`);
    return { erased: (r.rows[0] as { erased: boolean } | undefined)?.erased === true };
  });
}
