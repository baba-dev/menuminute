import { sql } from "drizzle-orm";
import { z } from "zod";
import { getPool } from "@/db";
import { withActor, withOutletRead, type Actor } from "@/modules/tenancy/service";
import { NotFoundError } from "@/lib/errors";

export const serviceSignalSchema = z
  .object({
    token: z.string().min(12).max(128),
    trackingToken: z.string().min(12).max(128),
    signal: z.enum(["call_server", "water_refill", "bill_request"]),
  })
  .strict();
export type GuestServiceRequest = {
  id: string;
  orderNumber: number;
  tableNumber: string;
  signal: "call_server" | "water_refill" | "bill_request";
  status: "requested" | "acknowledged" | "resolved";
  requestedAt: string;
  acknowledgedAt: string | null;
};
export type GuestServiceState = {
  requestId: string;
  signal: GuestServiceRequest["signal"];
  status: GuestServiceRequest["status"];
  requestedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
};
const identity = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
export const actionSchema = z
  .object({
    requestId: z.string().uuid(),
    action: z.enum(["acknowledge", "resolve"]),
  })
  .strict();

export async function callGuestService(orderId: string, raw: unknown) {
  identity.parse(orderId);
  const input = serviceSignalSchema.parse(raw);
  const result = await getPool().query<{
    data: { requestId: string; status: string; debounced: boolean };
  }>("select app_private.guest_service_call($1,$2,$3,$4) as data", [
    input.token,
    orderId,
    input.trackingToken,
    input.signal,
  ]);
  if (!result.rows[0]?.data) throw new NotFoundError("Service request");
  return result.rows[0].data;
}
export async function guestServiceState(
  orderId: string,
  token: string,
  trackingToken: string
): Promise<GuestServiceState[]> {
  identity.parse(orderId);
  serviceSignalSchema.pick({ token: true, trackingToken: true }).parse({ token, trackingToken });
  const result = await getPool().query<{ data: GuestServiceState[] }>(
    "select app_private.guest_service_state($1,$2,$3) as data",
    [token, orderId, trackingToken]
  );
  return result.rows[0]?.data ?? [];
}
export async function staffServiceRequests(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<GuestServiceRequest[]> {
  identity.parse(organizationId);
  identity.parse(outletId);
  return withOutletRead(actor, outletId, "orders.read", async (tx) => {
    const result = await tx.execute<{ data: GuestServiceRequest[] }>(
      sql`select app_private.staff_service_requests(${organizationId},${outletId}) as data`
    );
    return result.rows[0]?.data ?? [];
  });
}
export async function staffServiceRequestAction(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
) {
  identity.parse(organizationId);
  identity.parse(outletId);
  const input = actionSchema.parse(raw);
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
    const result = await tx.execute<{ data: { id: string; status: string } }>(
      sql`select app_private.staff_service_request_action(${organizationId},${outletId},${input.requestId},${input.action}) as data`
    );
    return result.rows[0]?.data;
  });
}
export const setKitchenAvailabilitySchema = z
  .object({
    menuId: identity,
    dishId: identity,
    soldOut: z.boolean(),
  })
  .strict();
export type KitchenDish = {
  id: string;
  menuId: string;
  name: string;
  category: string;
  soldOut: boolean;
};
export async function kitchenAvailableDishes(
  actor: Actor,
  organizationId: string,
  outletId: string
): Promise<KitchenDish[]> {
  identity.parse(organizationId);
  identity.parse(outletId);
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
    const r = await tx.execute<{ data: KitchenDish[] }>(
      sql`select app_private.kitchen_available_dishes(${organizationId},${outletId}) as data`
    );
    return r.rows[0]?.data ?? [];
  });
}
export async function kitchenSetAvailability(
  actor: Actor,
  organizationId: string,
  outletId: string,
  raw: unknown
) {
  identity.parse(organizationId);
  identity.parse(outletId);
  const input = setKitchenAvailabilitySchema.parse(raw);
  return withActor(actor, async (tx) => {
    await tx.execute(sql`select set_config('app.outlet_id',${outletId},true)`);
    const r = await tx.execute<{ data: { menuId: string; dishId: string; soldOut: boolean } }>(
      sql`select app_private.kitchen_set_dish_availability(${organizationId},${outletId},${input.menuId},${input.dishId},${input.soldOut}) as data`
    );
    return r.rows[0]?.data;
  });
}
