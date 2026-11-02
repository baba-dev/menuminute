import { describe, expect, it } from "vitest";
import {
  createSseParser,
  isTerminalOrderStatus,
  readTracking,
  sseEvent,
  streamSignature,
} from "@/modules/orders/guest-stream";

const base = { order: { status: "pending", updatedAt: "2026-11-02T10:00:00.000Z" } };

describe("guest order stream signals", () => {
  it("changes the signature for status, payment, kitchen progress and service requests only", () => {
    const a = streamSignature(base, []);
    expect(streamSignature(base, [])).toBe(a);
    expect(streamSignature({ order: { ...base.order, status: "accepted" } }, [])).not.toBe(a);
    expect(
      streamSignature({ order: { ...base.order, updatedAt: "2026-11-02T10:00:01.000Z" } }, [])
    ).not.toBe(a);
    expect(streamSignature({ ...base, partReady: { released: 1, total: 3 } }, [])).not.toBe(a);
    expect(streamSignature(base, [{ requestId: "r1", status: "requested" }])).not.toBe(a);
    expect(streamSignature(base, [{ requestId: "r1", status: "requested" }])).not.toBe(
      streamSignature(base, [{ requestId: "r1", status: "acknowledged" }])
    );
  });
  it("carries no personal data in the signature or events", () => {
    const sig = streamSignature(
      { order: { ...base.order, status: "ready" } } as Parameters<typeof streamSignature>[0],
      []
    );
    expect(sig).not.toMatch(/name|phone|notes/i);
    expect(sseEvent("changed", { status: "ready" })).toBe(
      'event: changed\ndata: {"status":"ready"}\n\n'
    );
  });
  it("recognises terminal statuses", () => {
    for (const status of ["served", "collected", "rejected", "cancelled", "expired"])
      expect(isTerminalOrderStatus(status)).toBe(true);
    for (const status of ["pending", "accepted", "preparing", "ready"])
      expect(isTerminalOrderStatus(status)).toBe(false);
  });
  it("rejects malformed tracking rows", () => {
    expect(() => readTracking({ order: {} })).toThrow();
    expect(readTracking({ ...base, extra: 1 }).order.status).toBe("pending");
  });
});

describe("SSE parser", () => {
  it("parses events split across chunks and ignores heartbeats", () => {
    const seen: [string, string][] = [];
    const feed = createSseParser((name, data) => seen.push([name, data]));
    feed("event: hel");
    feed('lo\ndata: {"status":"pending"}\n\n: keep-alive\n\nevent: changed\n');
    feed('data: {"status":"ready"}\n\n');
    expect(seen).toEqual([
      ["hello", '{"status":"pending"}'],
      ["changed", '{"status":"ready"}'],
    ]);
  });
  it("handles CRLF and bounds a runaway buffer", () => {
    const seen: string[] = [];
    const feed = createSseParser((name) => seen.push(name));
    feed("event: done\r\ndata: {}\r\n\r\n");
    expect(seen).toEqual(["done"]);
    feed("x".repeat(20000));
    feed("\n\nevent: changed\ndata: {}\n\n");
    expect(seen.at(-1)).toBe("changed");
  });
});
