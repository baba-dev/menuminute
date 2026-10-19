import { sql } from "drizzle-orm";
import { getDb, type Transaction } from "@/db";
import { ForbiddenError, UnauthorizedError } from "@/lib/errors";
export type Actor = { userId: string; sessionId?: string };
export type Permission =
  | "menu.read"
  | "menu.write"
  | "outlet.manage"
  | "orders.read"
  | "orders.accept"
  | "orders.prepare"
  | "orders.complete"
  | "orders.cancel"
  | "billing.manage";
export async function withActor<T>(
  actor: Actor,
  work: (tx: Transaction) => Promise<T>
): Promise<T> {
  if (!actor?.userId) throw new UnauthorizedError();
  return getDb().transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.actor_id',${actor.userId},true)`);
    await tx.execute(sql`select set_config('app.session_id',${actor.sessionId ?? ""},true)`);
    return work(tx);
  });
}
export async function withOutlet<T>(
  actor: Actor,
  outletId: string,
  permission: Permission,
  work: (tx: Transaction) => Promise<T>
): Promise<T> {
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
    const allowed = await tx.execute<{ allowed: boolean }>(
      sql`select app_private.lock_outlet(${outletId},${permission}) as allowed`
    );
    if (!allowed.rows[0]?.allowed) throw new ForbiddenError();
    return work(tx);
  });
}
