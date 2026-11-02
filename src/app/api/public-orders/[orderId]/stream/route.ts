import { observedRoute } from "@/lib/observed-route";
import { NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/config/env";
import { errorResponse } from "@/lib/request-context";
import { UnauthorizedError } from "@/lib/errors";
import { getGuestOrderTracking } from "@/modules/orders/service";
import { guestServiceState } from "@/modules/hospitality/service";
import {
  reserveOrderCapability,
  reserveOrderSource,
  verifiedOrderSource,
} from "@/modules/orders/rate-limit";
import {
  SSE_HEARTBEAT,
  STREAM_HEARTBEAT_MS,
  STREAM_MAX_LIFETIME_MS,
  STREAM_MAX_PER_PROCESS,
  STREAM_MAX_PER_SOURCE,
  STREAM_POLL_MS,
  isTerminalOrderStatus,
  readTracking,
  sseEvent,
  streamSignature,
} from "@/modules/orders/guest-stream";

const tokenSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const noStore = { "cache-control": "no-store" };

// Bounded, per-process admission. Exceeding it fails closed with 429; clients fall back to polling.
let open = 0;
const perSource = new Map<string, number>();

async function observed_GET(req: Request, context: { params: Promise<{ orderId: string }> }) {
  try {
    if (!env.PUBLIC_DINER_STREAM_ENABLED)
      return NextResponse.json({ enabled: false }, { status: 404, headers: noStore });
    let source: string;
    try {
      source = verifiedOrderSource(req);
      if (!(await reserveOrderSource("tracking", source)))
        return NextResponse.json({ message: "Limit reached" }, { status: 429, headers: noStore });
    } catch {
      return NextResponse.json(
        { message: "Temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }
    const { orderId } = await context.params;
    const token = tokenSchema.parse(new URL(req.url).searchParams.get("token"));
    const trackingToken = req.headers.get("x-tracking-token");
    if (!trackingToken || trackingToken.length > 128)
      throw new UnauthorizedError("Tracking token required");
    try {
      if (!(await reserveOrderCapability("tracking", source, token)))
        return NextResponse.json({ message: "Limit reached" }, { status: 429, headers: noStore });
    } catch {
      return NextResponse.json(
        { message: "Temporarily unavailable" },
        { status: 503, headers: noStore }
      );
    }
    if (open >= STREAM_MAX_PER_PROCESS || (perSource.get(source) ?? 0) >= STREAM_MAX_PER_SOURCE)
      return NextResponse.json({ message: "Live updates busy" }, { status: 429, headers: noStore });

    // Same capability check as the polling API: unknown or mismatched tokens throw here.
    const first = readTracking(await getGuestOrderTracking(token, orderId, trackingToken));
    const read = async () => {
      const [raw, services] = await Promise.all([
        getGuestOrderTracking(token, orderId, trackingToken),
        guestServiceState(orderId, token, trackingToken),
      ]);
      return { tracking: readTracking(raw), services };
    };
    const initialServices = await guestServiceState(orderId, token, trackingToken);

    open += 1;
    perSource.set(source, (perSource.get(source) ?? 0) + 1);
    const encoder = new TextEncoder();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      open -= 1;
      const left = (perSource.get(source) ?? 1) - 1;
      if (left <= 0) perSource.delete(source);
      else perSource.set(source, left);
    };
    let timer: ReturnType<typeof setTimeout> | undefined;
    let heartbeat: ReturnType<typeof setInterval> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const startedAt = Date.now();
        let last = streamSignature(first, initialServices);
        let closed = false;
        const send = (text: string) => controller.enqueue(encoder.encode(text));
        const close = () => {
          if (closed) return;
          closed = true;
          if (timer) clearTimeout(timer);
          if (heartbeat) clearInterval(heartbeat);
          release();
          try {
            controller.close();
          } catch {
            /* already closed by the client */
          }
        };
        req.signal.addEventListener("abort", close);
        send(sseEvent("hello", { status: first.order.status }));
        heartbeat = setInterval(() => !closed && send(SSE_HEARTBEAT), STREAM_HEARTBEAT_MS);
        const tick = async () => {
          if (closed) return;
          if (Date.now() - startedAt > STREAM_MAX_LIFETIME_MS) {
            send(sseEvent("reconnect"));
            return close();
          }
          try {
            const { tracking, services } = await read();
            const next = streamSignature(tracking, services);
            if (next !== last) {
              last = next;
              send(sseEvent("changed", { status: tracking.order.status }));
            }
            if (isTerminalOrderStatus(tracking.order.status)) {
              send(sseEvent("done"));
              return close();
            }
          } catch {
            // Capability revoked or storage unavailable: end the stream; the client falls back to polling.
            return close();
          }
          if (!closed) timer = setTimeout(() => void tick(), STREAM_POLL_MS);
        };
        timer = setTimeout(() => void tick(), STREAM_POLL_MS);
      },
      cancel() {
        if (timer) clearTimeout(timer);
        if (heartbeat) clearInterval(heartbeat);
        release();
      },
    });
    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-store, no-transform",
        // Nginx must not buffer this response.
        "x-accel-buffering": "no",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    return errorResponse(error, req);
  }
}

export const GET = observedRoute(observed_GET);
