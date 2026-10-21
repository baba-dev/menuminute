import { requestActor, errorResponse } from "@/lib/request-context";
import { kitchenChanges, kitchenSnapshot } from "@/modules/kitchen/service";
export const runtime = "nodejs";
// Per-instance guard in addition to Cloudflare/Nginx rate limits; never treated as a global distributed quota.
const activeStreams = new Map<string, number>();
export async function GET(
  req: Request,
  { params }: { params: Promise<{ organizationId: string; outletId: string }> }
) {
  try {
    const actor = await requestActor(req);
    const { organizationId, outletId } = await params;
    const first = await kitchenSnapshot(actor, organizationId, outletId);
    const streamKey = actor.userId + ":" + actor.sessionId + ":" + outletId;
    const active = activeStreams.get(streamKey) ?? 0;
    if (active >= 2)
      return new Response(JSON.stringify({ message: "Too many concurrent kitchen streams" }), {
        status: 429,
        headers: { "content-type": "application/json", "cache-control": "no-store" },
      });
    activeStreams.set(streamKey, active + 1);
    const started = Date.now();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      const count = activeStreams.get(streamKey) ?? 0;
      if (count <= 1) activeStreams.delete(streamKey);
      else activeStreams.set(streamKey, count - 1);
    };
    const encoder = new TextEncoder();
    let cancelled = false;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        let cursor = first.cursor;
        const send = (event: string, value: unknown, id?: number) => {
          const msg =
            (id === undefined ? "" : "id: " + id + "\n") +
            "event: " +
            event +
            "\n" +
            "data: " +
            JSON.stringify(value) +
            "\n\n";
          controller.enqueue(encoder.encode(msg));
        };
        send("snapshot", first, first.cursor);
        void (async () => {
          try {
            while (!cancelled && !req.signal.aborted && Date.now() - started < 55000) {
              await new Promise<void>((resolve) => setTimeout(resolve, 3000));
              if (cancelled || req.signal.aborted) break;
              // Revalidate the session and current outlet/station role at EVERY heartbeat.
              const fresh = await requestActor(req);
              if (fresh.userId !== actor.userId || fresh.sessionId !== actor.sessionId)
                throw new Error("Session changed");
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
          } catch {
            if (!cancelled && !req.signal.aborted)
              try {
                send("revoked", {
                  message: "Kitchen connection requires a fresh login or permission check",
                });
              } catch {}
          } finally {
            release();
            try {
              controller.close();
            } catch {}
          }
        })();
      },
      cancel() {
        cancelled = true;
        release();
      },
    });
    return new Response(body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        "X-Accel-Buffering": "no",
        Connection: "keep-alive",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
