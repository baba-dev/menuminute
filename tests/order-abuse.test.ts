import { describe, expect, it } from "vitest";
import { verifiedOrderSource, reserveOrderCapability, reserveOrderSource } from "../src/modules/orders/rate-limit";

const secret = "isolated-test-trusted-proxy-secret-with-48-chars-";
function request(headers: Record<string, string> = {}) {
  return new Request("https://localhost/api/public-orders", { headers });
}

describe("order edge provenance and abuse controls", () => {
  it("ignores spoofable forwarding headers and fails closed without trusted proof", () => {
    expect(() =>
      verifiedOrderSource(
        request({
          "cf-connecting-ip": "203.0.113.9",
          "x-real-ip": "203.0.113.10",
          "x-forwarded-for": "203.0.113.11",
        }),
        secret
      )
    ).toThrow("Order edge identity is unavailable");
    expect(() =>
      verifiedOrderSource(
        request({
          "x-menuminute-client-ip": "203.0.113.9",
          "x-menuminute-edge-key": "not-the-actual-key",
        }),
        secret
      )
    ).toThrow();
    expect(() =>
      verifiedOrderSource(
        request({
          "x-menuminute-client-ip": "not-an-ip",
          "x-menuminute-edge-key": secret,
        }),
        secret
      )
    ).toThrow();
    expect(() =>
      verifiedOrderSource(
        request({
          "x-menuminute-client-ip": "203.0.113.9",
          "x-menuminute-edge-key": secret,
        }),
        undefined
      )
    ).toBeDefined();
    expect(
      verifiedOrderSource(
        request({
          "cf-connecting-ip": "192.0.2.199",
          "x-real-ip": "192.0.2.198",
          "x-forwarded-for": "192.0.2.197",
          "x-menuminute-client-ip": "203.0.113.9",
          "x-menuminute-edge-key": secret,
        }),
        secret
      )
    ).toBe("203.0.113.9");
  });

  it("counts verified source requests before token resolution and enforces source/QR quotas", async () => {
    const nonce = crypto.randomUUID();
    const ip = "198.19." + Math.floor(Math.random() * 128) + "." + Math.floor(Math.random() * 256);
    // Preflight is a shared global/IP reservation, not one Redis key per arbitrary token.
    expect(await reserveOrderSource("submit", ip)).toBe(true);
    const token = "qr-" + nonce;
    for (let i = 0; i < 15; i++) {
      expect(await reserveOrderCapability("submit", ip, token, nonce)).toBe(true);
    }
    expect(await reserveOrderCapability("submit", ip, token, nonce)).toBe(false);
    // A different verified source is not blocked by another diner's 15/QR quota.
    expect(await reserveOrderCapability("submit", "192.0.2.89", token, nonce)).toBe(true);
  });

  it("caps aggregate submissions across distinct QR tokens of one outlet", async () => {
    const outlet = crypto.randomUUID();
    for (let i = 0; i < 120; i++) {
      expect(
        await reserveOrderCapability(
          "submit",
          "198.19." + Math.floor(i / 250) + "." + (i % 250),
          "qr-" + outlet + "-" + i,
          outlet
        )
      ).toBe(true);
    }
    expect(await reserveOrderCapability("submit", "198.19.2.10", "another-" + outlet, outlet)).toBe(
      false
    );
  });
});
