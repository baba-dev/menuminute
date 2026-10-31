import { createECDH } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parsePushWorkerSettings } from "../src/modules/pwa/push-worker";

describe("isolated worker PWA configuration", () => {
  it("starts with only worker credentials and does not parse the web app environment", () => {
    expect(
      parsePushWorkerSettings({
        WORKER_DATABASE_URL: "postgresql://worker:test@localhost:5432/test",
        REDIS_QUEUE_URL: "redis://localhost:6379",
      })
    ).toBeNull();
  });

  it("fails closed for invalid flags, missing keys and repeated outlet IDs", () => {
    expect(() => parsePushWorkerSettings({ PWA_PUSH_ENABLED: "yes" })).toThrow();
    expect(() => parsePushWorkerSettings({ PWA_PUSH_ENABLED: "true" })).toThrow();
    expect(() =>
      parsePushWorkerSettings({ PWA_PUSH_ENABLED: "true", PWA_PUSH_OUTLET_IDS: "outlet,outlet" })
    ).toThrow();
  });

  it("accepts reviewed push-only settings independent from APP_URL and AUTH_SECRET", () => {
    const ecdh = createECDH("prime256v1");
    ecdh.generateKeys();
    const config = parsePushWorkerSettings({
      PWA_PUSH_ENABLED: "true",
      PWA_PUSH_OUTLET_IDS: "outlet-a,outlet-b",
      PWA_PUSH_VAPID_PUBLIC_KEY: ecdh.getPublicKey().toString("base64url"),
      PWA_PUSH_VAPID_PRIVATE_KEY: ecdh.getPrivateKey().toString("base64url"),
      PWA_PUSH_VAPID_SUBJECT: "mailto:admin@bababuilds.com",
    });
    expect(config?.outletIds).toEqual(["outlet-a", "outlet-b"]);
  });
});
