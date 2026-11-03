import { NextResponse } from "next/server";
import { z } from "zod";
import { observedRoute } from "@/lib/observed-route";
import { errorResponse } from "@/lib/request-context";
import {
  publicOrderOutlet,
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";
import { publicCheckoutTaxPolicy } from "@/modules/tax/checkout";

const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * Publish only the non-sensitive merchant tax policy for the authenticated QR
 * capability. Prices in the diner's cart remain estimates until the server
 * re-quotes the published catalog and verifies the policy in the order transaction.
 */
async function observed_GET(request: Request) {
  try {
    const source = verifiedOrderSource(request);
    if (!(await reserveOrderSource("tracking", source)))
      return NextResponse.json({ message: "Please retry shortly" }, { status: 429 });
    const token = tokenSchema.parse(new URL(request.url).searchParams.get("token"));
    const outletId = await publicOrderOutlet(token);
    if (!outletId) return NextResponse.json({ message: "Menu unavailable" }, { status: 404 });
    if (!(await reserveOrderCapability("tracking", source, token)))
      return NextResponse.json({ message: "Please retry shortly" }, { status: 429 });
    const policy = await publicCheckoutTaxPolicy(token);
    return NextResponse.json(policy, {
      headers: { "cache-control": "private, no-store", "x-robots-tag": "noindex" },
    });
  } catch (error) {
    return errorResponse(error, request);
  }
}
export const GET = observedRoute(observed_GET);
