import { describe, expect, it } from "vitest";
import { boundedBytes } from "../src/lib/bounded-input";

describe("phase B bounded request streams", () => {
  it("accepts the exact byte limit", async () => {
    const req = new Request("https://example.invalid/api/test", { method: "POST", body: "a".repeat(32) });
    expect((await boundedBytes(req, 32)).length).toBe(32);
  });
  it("rejects a chunked stream without Content-Length", async () => {
    const body = new ReadableStream({
      start(c) { c.enqueue(new TextEncoder().encode("12345678")); c.enqueue(new TextEncoder().encode("9")); c.close(); },
    });
    const req = new Request("https://example.invalid/api/test", { method: "POST", body, duplex: "half" } as RequestInit);
    await expect(boundedBytes(req, 8)).rejects.toMatchObject({ statusCode: 413 });
  });
});
