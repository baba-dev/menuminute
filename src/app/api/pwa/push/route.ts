import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { observedRoute } from "@/lib/observed-route";
import { requestActor, errorResponse } from "@/lib/request-context";
import { getDefaultOrActiveRestaurant } from "@/modules/restaurants/service";
import { withOutlet, withOutletRead } from "@/modules/tenancy/service";
import { env } from "@/lib/config/env";
import { allowedPushEndpoint } from "@/modules/pwa/vapid";
import { reservePushMutation } from "@/modules/pwa/push-rate-limit";

const headers = { "cache-control": "private, no-store", vary: "Cookie" };
const subscriptionInput = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("subscribe"),
      endpoint: z.string().min(35).max(2048),
      newOrders: z.boolean(),
      kitchenUpdates: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("unsubscribe"),
      endpoint: z.string().min(35).max(2048),
    })
    .strict(),
]);

async function scope(req: Request, mutation: boolean) {
  const actor = await requestActor(req, mutation);
  const outlet = await getDefaultOrActiveRestaurant(
    actor.userId,
    (await cookies()).get("menuminute.outlet")?.value
  );
  if (!outlet) throw new Error("A restaurant workspace is required");
  return { actor, outlet };
}

async function handleGet(req: Request) {
  try {
    const { actor, outlet } = await scope(req, false);
    const result = await withOutletRead(actor, outlet.id, "orders.read", (tx) =>
      tx.execute<{ list: unknown }>(sql`select app_private.pwa_push_list(${outlet.id}) as list`)
    );
    const enabled = env.PWA_PUSH_ENABLED && env.PWA_PUSH_OUTLET_IDS.includes(outlet.id);
    return NextResponse.json(
      {
        enabled,
        publicKey: enabled ? env.PWA_PUSH_VAPID_PUBLIC_KEY : null,
        outletId: outlet.id,
        subscriptions: result.rows[0]?.list ?? [],
      },
      { headers }
    );
  } catch (error) {
    const result = errorResponse(error, req);
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  }
}

async function handlePost(req: Request) {
  try {
    const { actor, outlet } = await scope(req, true);
    await reservePushMutation(actor, outlet.id);
    // Bound JSON before parsing; never log endpoints, keys or browser identifiers.
    const raw = await req.text();
    if (raw.length > 3500)
      return NextResponse.json({ message: "Request too large" }, { status: 413, headers });
    const input = subscriptionInput.parse(JSON.parse(raw));
    if (!allowedPushEndpoint(input.endpoint))
      return NextResponse.json({ message: "Unsupported push service" }, { status: 422, headers });
    if (
      input.action === "subscribe" &&
      (!env.PWA_PUSH_ENABLED || !env.PWA_PUSH_OUTLET_IDS.includes(outlet.id))
    ) {
      return NextResponse.json(
        { message: "Device alerts are not enabled for this outlet" },
        { status: 403, headers }
      );
    }
    const hash = createHash("sha256").update(input.endpoint).digest("hex");
    await withOutlet(actor, outlet.id, "orders.read", async (tx) => {
      if (input.action === "unsubscribe")
        await tx.execute(sql`select app_private.pwa_push_unsubscribe(${outlet.id},${hash})`);
      else
        await tx.execute(
          sql`select app_private.pwa_push_subscribe(${outlet.id},${input.endpoint},${hash},${input.newOrders},${input.kitchenUpdates})`
        );
    });
    return NextResponse.json({ ok: true }, { headers });
  } catch (error) {
    const result = errorResponse(error, req);
    result.headers.set("Cache-Control", "private, no-store");
    return result;
  }
}

export const GET = observedRoute(handleGet);
export const POST = observedRoute(handlePost);
