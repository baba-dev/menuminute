import { z } from "zod";
import { getPool } from "@/db";
import { env } from "@/lib/config/env";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { allowedPushEndpoint, pushEndpointHash } from "@/modules/pwa/vapid";
import { publicOrderOutlet } from "@/modules/orders/rate-limit";

const identity = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/);
const trackingToken = z.string().min(12).max(128);

export const guestPushSubscribeSchema = z
  .object({
    token: identity,
    trackingToken,
    endpoint: z.string().min(35).max(2048),
  })
  .strict();
export const guestPushUnsubscribeSchema = guestPushSubscribeSchema;

/**
 * Guest push shares the staff rollout gate: the feature switch and the exact outlet allowlist.
 * Returns the outlet id when push is on for it, otherwise null (callers answer "not enabled").
 */
export async function guestPushOutlet(menuToken: string): Promise<string | null> {
  if (!env.PWA_PUSH_ENABLED) return null;
  identity.parse(menuToken);
  const outletId = await publicOrderOutlet(menuToken);
  return outletId && env.PWA_PUSH_OUTLET_IDS.includes(outletId) ? outletId : null;
}

function mapError(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error ? error.message : "";
  if (code === "42501") throw new NotFoundError("Order");
  if (code === "22023") throw new ValidationError(message || "Invalid notification request");
  throw error;
}

export async function guestPushState(
  menuToken: string,
  orderId: string,
  tracking: string,
  endpointHash: string | null
) {
  identity.parse(menuToken);
  identity.parse(orderId);
  trackingToken.parse(tracking);
  try {
    const result = await getPool().query<{ data: { subscribed: boolean } }>(
      "select app_private.guest_push_state($1,$2,$3,$4) as data",
      [menuToken, orderId, tracking, endpointHash]
    );
    return result.rows[0]!.data;
  } catch (error) {
    return mapError(error);
  }
}

export async function guestPushSubscribe(orderId: string, raw: unknown) {
  identity.parse(orderId);
  const input = guestPushSubscribeSchema.parse(raw);
  // Only well-known push services are accepted; the browser-supplied URL is never fetched here.
  if (!allowedPushEndpoint(input.endpoint)) throw new ValidationError("Unsupported push service");
  try {
    await getPool().query("select app_private.guest_push_subscribe($1,$2,$3,$4,$5)", [
      input.token,
      orderId,
      input.trackingToken,
      input.endpoint,
      pushEndpointHash(input.endpoint),
    ]);
  } catch (error) {
    return mapError(error);
  }
  return { subscribed: true };
}

export async function guestPushUnsubscribe(orderId: string, raw: unknown) {
  identity.parse(orderId);
  const input = guestPushUnsubscribeSchema.parse(raw);
  try {
    await getPool().query("select app_private.guest_push_unsubscribe($1,$2,$3,$4)", [
      input.token,
      orderId,
      input.trackingToken,
      pushEndpointHash(input.endpoint),
    ]);
  } catch (error) {
    return mapError(error);
  }
  return { subscribed: false };
}
