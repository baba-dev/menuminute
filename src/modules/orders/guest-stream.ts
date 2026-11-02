/**
 * Live order signalling for diners. The stream carries only "something changed" signals; the client
 * always re-reads authoritative state through the normal tracking API, so a missed or duplicated
 * signal can never show a wrong status, and polling remains the fallback.
 */
import { z } from "zod";

export const STREAM_POLL_MS = 3000;
export const STREAM_HEARTBEAT_MS = 20000;
export const STREAM_MAX_LIFETIME_MS = 4 * 60 * 1000;
export const STREAM_MAX_PER_PROCESS = 200;
export const STREAM_MAX_PER_SOURCE = 4;

export const TERMINAL_ORDER_STATUSES = [
  "served",
  "collected",
  "rejected",
  "cancelled",
  "expired",
] as const;

const trackingShape = z.object({
  order: z.object({
    status: z.string(),
    updatedAt: z.union([z.string(), z.date()]),
    paymentStatus: z.string().optional(),
  }),
  partReady: z.object({ released: z.number(), total: z.number() }).nullish(),
});
/** Narrows the tracking service result; a malformed row ends the stream instead of misreporting. */
export function readTracking(value: unknown): TrackingLike {
  return trackingShape.parse(value);
}

type TrackingLike = {
  order: { status: string; updatedAt: string | Date; paymentStatus?: string };
  partReady?: { released: number; total: number } | null;
};
type ServiceLike = { requestId: string; status: string }[];

/** Stable fingerprint of everything a diner can see change; no personal data. */
export function streamSignature(tracking: TrackingLike, services: ServiceLike = []): string {
  return JSON.stringify([
    tracking.order.status,
    tracking.order.paymentStatus ?? null,
    new Date(tracking.order.updatedAt).getTime(),
    tracking.partReady ? [tracking.partReady.released, tracking.partReady.total] : null,
    services.map((s) => s.requestId + ":" + s.status),
  ]);
}

export function isTerminalOrderStatus(status: string) {
  return (TERMINAL_ORDER_STATUSES as readonly string[]).includes(status);
}

export function sseEvent(name: string, data: unknown = {}, id?: string) {
  return (id ? `id: ${id}\n` : "") + `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}
export const SSE_HEARTBEAT = ": keep-alive\n\n";

/** Incremental parser for the subset of SSE the stream emits (event + data lines). */
export function createSseParser(onEvent: (name: string, data: string) => void) {
  let buffer = "";
  return (chunk: string) => {
    buffer += chunk.replace(/\r\n/g, "\n");
    let boundary = buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      let name = "message";
      const data: string[] = [];
      for (const line of block.split("\n")) {
        if (line.startsWith(":")) continue;
        if (line.startsWith("event:")) name = line.slice(6).trim();
        else if (line.startsWith("data:")) data.push(line.slice(5).trim());
      }
      if (block.trim() && !block.split("\n").every((l) => l.startsWith(":"))) {
        onEvent(name, data.join("\n"));
      }
      boundary = buffer.indexOf("\n\n");
    }
    // A hostile or broken server must not grow the buffer without bound.
    if (buffer.length > 16384) buffer = "";
  };
}
