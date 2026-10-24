import { z } from "zod";

export const MAX_CART_LINES = 50;
export const MAX_ITEM_QUANTITY = 999;

const pendingBody = z
  .object({
    token: z.string().min(1).max(128),
    clientSubmissionKey: z.uuid(),
    quotedTotalMinor: z.number().int().min(0).max(2147483647),
    fulfillmentMode: z.enum(["dine_in", "pickup"]),
    requestedFulfillmentAt: z.iso.datetime().nullable(),
    customerName: z.string().max(80),
    customerPhone: z.string().max(30),
    notes: z.string().max(500),
    items: z
      .array(
        z.object({
          dishId: z.string().min(1).max(128),
          variantId: z.string().min(1).max(128).nullable(),
          selectedAddOns: z.array(
            z.object({ groupId: z.string().min(1).max(128), optionId: z.string().min(1).max(128) })
          ),
          quantity: z.number().int().min(1).max(MAX_ITEM_QUANTITY),
          itemNotes: z.string().max(200),
        })
      )
      .min(1)
      .max(MAX_CART_LINES),
  })
  .strict();

export type PendingGuestOrder = z.infer<typeof pendingBody>;
const pending = z.object({ body: pendingBody, savedAt: z.number().int().positive() }).strict();

export const pendingOrderStorageKey = (token: string) => `pending_order_${token}`;

export function readPendingGuestOrder(raw: string | null, token: string): PendingGuestOrder | null {
  if (!raw) return null;
  try {
    const parsed = pending.parse(JSON.parse(raw));
    if (parsed.body.token !== token) return null;
    // Do not let abandoned personal details survive indefinitely on a shared device.
    if (Date.now() - parsed.savedAt > 24 * 60 * 60 * 1000) return null;
    return parsed.body;
  } catch {
    return null;
  }
}

export function writePendingGuestOrder(body: PendingGuestOrder) {
  sessionStorage.setItem(
    pendingOrderStorageKey(body.token),
    JSON.stringify({ body, savedAt: Date.now() })
  );
}

export function clearPendingGuestOrder(token: string) {
  sessionStorage.removeItem(pendingOrderStorageKey(token));
}
