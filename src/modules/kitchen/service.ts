import { sql, eq } from "drizzle-orm";
import { z } from "zod";
import { withOutlet, type Actor } from "@/modules/tenancy/service";
import { restaurants } from "@/db/schema";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "@/lib/errors";
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const adminSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("station.create"),
    data: z.object({ name: z.string().trim().min(2).max(64) }).strict(),
  }),
  z.object({
    action: z.literal("station.rename"),
    data: z.object({ stationId: id, name: z.string().trim().min(2).max(64) }).strict(),
  }),
  ...(["member.assign", "member.remove"] as const).map((action) =>
    z.object({
      action: z.literal(action),
      data: z.object({ stationId: id, memberId: id }).strict(),
    })
  ),
  ...(["route.assign", "route.remove"] as const).map((action) =>
    z.object({ action: z.literal(action), data: z.object({ stationId: id, dishId: id }).strict() })
  ),
  z.object({ action: z.literal("settings.disable"), data: z.object({}).strict() }),
]);
const workSchema = z
  .object({
    workId: id,
    action: z.enum(["start", "complete"]),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();
export type KitchenWorkView = {
  id: string;
  stationId: string;
  orderId: string;
  orderNumber: number;
  fulfillmentMode: string;
  tableLabel: string | null;
  brandLabel: string;
  dishName: string;
  quantity: number;
  variantName: string | null;
  selectedOptions: Array<{ groupName: string; optionName: string }>;
  notes: string | null;
  orderNotes: string | null;
  status: "queued" | "preparing" | "complete" | "cancelled";
  version: number;
  createdAt: string;
  updatedAt: string;
};
export type KitchenSnapshot = {
  cursor: number;
  enabled: boolean;
  routes: Array<{ dishId: string; stationId: string; ruleVersion: number }>;
  stations: Array<{ id: string; name: string; active: boolean; position: number }>;
  work: KitchenWorkView[];
};
export type KitchenChanges = {
  cursor: number;
  resync: boolean;
  events: Array<{ seq: number; kind: string }>;
};
function mapError(error: unknown): never {
  const e = error instanceof Error && error.cause ? error.cause : error;
  const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
  if (code === "42501") throw new ForbiddenError("Kitchen access or operation denied");
  if (code === "40001") throw new ConflictError("Kitchen work has changed. Refresh the board.");
  if (code === "22023") throw new ValidationError("Invalid kitchen configuration or transition");
  throw error;
}
async function ensureOrganization(
  tx: import("@/db").Transaction,
  outletId: string,
  organizationId: string
) {
  const [r] = await tx
    .select({ organizationId: restaurants.organizationId })
    .from(restaurants)
    .where(eq(restaurants.id, outletId));
  if (!r || r.organizationId !== organizationId) throw new NotFoundError("Outlet");
}
export async function kitchenSnapshot(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<KitchenSnapshot> {
  id.parse(organizationId);
  id.parse(outletId);
  try {
    return await withOutlet(actor, outletId, "orders.read", async (tx) => {
      await ensureOrganization(tx, outletId, organizationId);
      const r = await tx.execute<{ data: KitchenSnapshot }>(
        sql`select app_private.kitchen_snapshot(${outletId}) as data`
      );
      return r.rows[0]!.data;
    });
  } catch (e) {
    mapError(e);
  }
}
export async function kitchenChanges(
  actor: Actor,
  organizationId: string,
  outletId: string,
  cursor: number
): Promise<KitchenChanges> {
  id.parse(organizationId);
  id.parse(outletId);
  z.number().int().nonnegative().safe().parse(cursor);
  try {
    return await withOutlet(actor, outletId, "orders.read", async (tx) => {
      await ensureOrganization(tx, outletId, organizationId);
      const r = await tx.execute<{ data: KitchenChanges }>(
        sql`select app_private.kitchen_changes(${outletId},${cursor}::bigint,100) as data`
      );
      return r.rows[0]!.data;
    });
  } catch (e) {
    mapError(e);
  }
}
export async function kitchenAdmin(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
) {
  id.parse(organizationId);
  id.parse(outletId);
  const input = adminSchema.parse(raw);
  try {
    return await withOutlet(actor, outletId, "outlet.manage", async (tx) => {
      await ensureOrganization(tx, outletId, organizationId);
      const r = await tx.execute<{ data: Record<string, unknown> }>(
        sql`select app_private.kitchen_admin(${outletId},${input.action},${JSON.stringify(input.data)}::jsonb) as data`
      );
      return r.rows[0]!.data;
    });
  } catch (e) {
    mapError(e);
  }
}
export async function kitchenWorkCommand(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
) {
  id.parse(organizationId);
  id.parse(outletId);
  const input = workSchema.parse(raw);
  try {
    return await withOutlet(actor, outletId, "orders.prepare", async (tx) => {
      await ensureOrganization(tx, outletId, organizationId);
      const r = await tx.execute<{
        data: { workId: string; status: string; version: number; seq: number };
      }>(
        sql`select app_private.kitchen_work_command(${outletId},${input.workId},${input.action},${input.expectedVersion}) as data`
      );
      return r.rows[0]!.data;
    });
  } catch (e) {
    mapError(e);
  }
}

export async function kitchenCanManage(actor:Actor,outletId:string):Promise<boolean>{
 try{await withOutlet(actor,outletId,"outlet.manage",async()=>true);return true;}
 catch(e){if(e instanceof ForbiddenError)return false;throw e;}
}
