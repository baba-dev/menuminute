import { z } from "zod";
import { UnauthorizedError } from "@/lib/errors";
import { errorResponse } from "@/lib/request-context";
import { kitchenChanges, kitchenSnapshot } from "@/modules/kitchen/service";
import { acquireKitchenStream } from "@/modules/kitchen/stream-lease";
import { isKitchenStreamRevocation, kitchenStreamActor } from "@/modules/kitchen/stream-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const noStore = { "content-type": "application/json", "cache-control": "private, no-store" };
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function GET(
  req: Request,
  { params }: { params: Promise<{ organizationId: string; outletId: string }> }
) {
  let lease: Awaited<ReturnType<typeof acquireKitchenStream>> = null;
  try {
    const actor = await kitchenStreamActor(req);
    const { organizationId, outletId } = await params;
    id.parse(organizationId);
    id.parse(outletId);
    // Admission BEFORE the expensive snapshot. Redis is the cross-instance
    // authority; an unavailable limiter fails closed rather than opening slots.
    try {
      lease = await acquireKitchenStream(actor.userId, actor.sessionId, outletId);
    } catch {
      return new Response(JSON.stringify({ message: "Kitchen stream temporarily unavailable" }), {
        status: 503,
        headers: noStore,
      });
    }
    if (!lease)
      return new Response(JSON.stringify({ message: "Too many concurrent kitchen streams" }), {
        status: 429,
        headers: { ...noStore, "retry-after": "5" },
      });
    const first = await kitchenSnapshot(actor, organizationId, outletId);
    const admittedLease = lease;
    const started = Date.now();
    const encoder = new TextEncoder();
    let cancelled = false;
    let finished = false;
    const release = async () => {
      if (finished) return;
      finished = true;
      await admittedLease.release().catch(() => {
        // Redis TTL is the crash/failure recovery path; never mask stream cleanup.
      });
    };
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let cursor = first.cursor;
        const send = (event: string, value: unknown, seq?: number) => {
          const data =
            (seq === undefined ? "" : "id: " + seq + "\n") +
            "event: " +
            event +
            "\ndata: " +
            JSON.stringify(value) +
            "\n\n";
          controller.enqueue(encoder.encode(data));
        };
        send("snapshot", first, first.cursor);
        void (async () => {
          try {
            while (!cancelled && !req.signal.aborted && Date.now() - started < 55_000) {
              await wait(3000);
              if (cancelled || req.signal.aborted) break;
              // A lost Redis lease is transient unavailability, not a revoked role.
              if (!(await admittedLease.renew())) throw new Error("Stream lease expired");
              const fresh = await kitchenStreamActor(req);
              if (fresh.userId !== actor.userId || fresh.sessionId !== actor.sessionId)
                throw new UnauthorizedError("Session identity changed");
              const changes = await kitchenChanges(fresh, organizationId, outletId, cursor);
              if (changes.resync || changes.events.length) {
                const latest = await kitchenSnapshot(fresh, organizationId, outletId);
                send("snapshot", latest, latest.cursor);
                cursor = latest.cursor;
              } else {
                cursor = changes.cursor;
                send("heartbeat", { cursor });
              }
            }
          } catch (error) {
            if (!cancelled && !req.signal.aborted)
              try {
                if (isKitchenStreamRevocation(error)) {
                  send("revoked", { message: "Kitchen access or session has changed" });
                } else {
                  send("unavailable", { message: "Kitchen stream interrupted. Reconnecting…" });
                }
              } catch {
                // Browser disconnects can close the stream before the final event.
              }
          } finally {
            await release();
            try {
              controller.close();
            } catch {
              // Cancellation may already have closed this stream.
            }
          }
        })();
      },
      cancel() {
        cancelled = true;
        void release();
      },
    });
    return new Response(body, {
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "private, no-store, no-transform",
        "x-accel-buffering": "no",
      },
    });
  } catch (e) {
    if (lease) await lease.release().catch(() => {});
    return errorResponse(e, req);
  }
}
