import { describe, expect, it } from "vitest";
import { boundedBytes } from "../src/lib/bounded-input";

function streamedRequest(bytes: number, chunkSize: number) {
  let sent = 0;
  let cancelled = false;
  const req = new Request("https://localhost/api/public-orders", {
    method: "POST",
    duplex: "half",
    body: new ReadableStream<Uint8Array>({
      pull(controller) {
        if (sent >= bytes) {
          controller.close();
          return;
        }
        const size = Math.min(chunkSize, bytes - sent);
        sent += size;
        controller.enqueue(new Uint8Array(size));
      },
      cancel() {
        cancelled = true;
      },
    }),
  } as RequestInit);
  return { req, bytesConsumed: () => sent, wasCancelled: () => cancelled };
}

describe("bounded order body input", () => {
  it("accepts exactly 64 KiB without relying on Content-Length", async () => {
    const { req } = streamedRequest(65536, 8192);
    expect((await boundedBytes(req, 65536)).byteLength).toBe(65536);
  });
  it("rejects a 64 KiB + 1 streamed body before buffering the entire upload", async () => {
    const stream = streamedRequest(1024 * 1024, 8192);
    await expect(boundedBytes(stream.req, 65536)).rejects.toMatchObject({
      statusCode: 413,
    });
    expect(stream.bytesConsumed()).toBeLessThan(1024 * 1024);
    expect(stream.wasCancelled()).toBe(true);
  });
});
