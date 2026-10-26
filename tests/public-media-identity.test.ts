import { describe, expect, it } from "vitest";
import { env } from "../src/lib/config/env";
import { publicClientIdentity } from "../src/lib/public-rate-limit";

const url = "https://food.bababuilds.com/api/public-media/example";

describe("public photo rate-limit identity", () => {
  it("refuses spoofed client forwarding headers and missing proxy proof", () => {
    expect(() =>
      publicClientIdentity(
        new Request(url, {
          headers: {
            "x-forwarded-for": "203.0.113.50",
            "cf-connecting-ip": "203.0.113.50",
            "x-menuminute-client-ip": "203.0.113.50",
          },
        })
      )
    ).toThrow("Order edge identity is unavailable");
  });

  it("requires the existing signed edge secret and a valid IP address", () => {
    const key = env.ORDER_EDGE_SHARED_SECRET!;
    expect(key.length).toBeGreaterThanOrEqual(32);
    const identity = publicClientIdentity(
      new Request(url, {
        headers: {
          "x-menuminute-edge-key": key,
          "x-menuminute-client-ip": "198.51.100.27",
          "x-forwarded-for": "203.0.113.99",
        },
      })
    );
    expect(identity).toBe("198.51.100.27");
    expect(() =>
      publicClientIdentity(
        new Request(url, {
          headers: {
            "x-menuminute-edge-key": key,
            "x-menuminute-client-ip": "invalid-ip",
          },
        })
      )
    ).toThrow();
  });
});
