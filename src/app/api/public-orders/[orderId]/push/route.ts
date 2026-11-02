import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { boundedBytes } from "@/lib/bounded-input";
import { errorResponse } from "@/lib/request-context";
import { UnauthorizedError } from "@/lib/errors";
import {
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";
import {
  guestPushOutlet,
  guestPushState,
  guestPushSubscribe,
  guestPushUnsubscribe,
} from "@/modules/guest-push/service";

type Params = { params: Promise<{ orderId: string }> };
const headers = { "cache-control": "private, no-store" };
const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

/** Same bounded, fail-closed allowances as order tracking. Returns a response to send, or null. */
async function admit(req: Request, menuToken: string, write: boolean) {
  if (write && req.headers.get("origin") !== new URL(env.APP_URL).origin)
    return NextResponse.json({ message: "Invalid request origin" }, { status: 403, headers });
  try {
    const source = verifiedOrderSource(req);
    if (!(await reserveOrderSource("tracking", source)))
      return NextResponse.json({ message: "Limit reached" }, { status: 429, headers });
    if (!(await reserveOrderCapability("tracking", source, menuToken)))
      return NextResponse.json({ message: "Limit reached" }, { status: 429, headers });
  } catch {
    return NextResponse.json({ message: "Temporarily unavailable" }, { status: 503, headers });
  }
  return null;
}
const notEnabled = () => NextResponse.json({ enabled: false }, { status: 200, headers });

async function observed_GET(req: Request, { params }: Params) {
  try {
    const url = new URL(req.url);
    const token = tokenSchema.parse(url.searchParams.get("token"));
    const denied = await admit(req, token, false);
    if (denied) return denied;
    if (!(await guestPushOutlet(token))) return notEnabled();
    const tracking = req.headers.get("x-tracking-token");
    if (!tracking) throw new UnauthorizedError("Tracking token required");
    const hash = url.searchParams.get("hash");
    const state = await guestPushState(
      token,
      (await params).orderId,
      tracking,
      hash && /^[0-9a-f]{64}$/.test(hash) ? hash : null
    );
    return NextResponse.json(
      { enabled: true, publicKey: env.PWA_PUSH_VAPID_PUBLIC_KEY ?? null, ...state },
      { headers }
    );
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_POST(req: Request, { params }: Params) {
  try {
    const body = JSON.parse((await boundedBytes(req, 3500)).toString("utf8"));
    const token = tokenSchema.parse(body?.token);
    const denied = await admit(req, token, true);
    if (denied) return denied;
    if (!(await guestPushOutlet(token))) return notEnabled();
    return NextResponse.json(await guestPushSubscribe((await params).orderId, body), { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}

async function observed_DELETE(req: Request, { params }: Params) {
  try {
    const body = JSON.parse((await boundedBytes(req, 3500)).toString("utf8"));
    const token = tokenSchema.parse(body?.token);
    const denied = await admit(req, token, true);
    if (denied) return denied;
    // Unsubscribing stays possible even if the rollout is later switched off.
    return NextResponse.json(await guestPushUnsubscribe((await params).orderId, body), { headers });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
export const POST = observedRoute(observed_POST);
export const DELETE = observedRoute(observed_DELETE);
