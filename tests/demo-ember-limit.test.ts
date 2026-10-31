import { beforeEach, describe, expect, it } from "vitest";
import { redisClient } from "../src/lib/redis";
import { DEMO_EMBER_PROMPT_CHARS, enforceDemoEmber } from "../src/modules/demo/ember-limit";
import { DEMO_IDS } from "../src/modules/demo/ids";
import { vi } from "vitest";

const req = (ip: string) => new Request("http://localhost/x", { headers: { "x-real-ip": ip } });
const limits = { dailyTurns: 5, sourceTurns: 3 };

describe("demo Ember allowance", () => {
  beforeEach(async () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "true");
    const redis = await redisClient("cache");
    const keys = await redis.keys("demo:ember:*");
    if (keys.length) await redis.del(keys);
  });

  it("does nothing for any user other than the demo account", async () => {
    for (let i = 0; i < 20; i++)
      await enforceDemoEmber(req("1.1.1.1"), "real-user", "turn", "x".repeat(5000), limits);
  });
  it("caps prompt length for the demo account", async () => {
    await expect(
      enforceDemoEmber(
        req("2.2.2.2"),
        DEMO_IDS.userId,
        "turn",
        "x".repeat(DEMO_EMBER_PROMPT_CHARS + 1),
        limits
      )
    ).rejects.toThrow(/limited to 280 characters/);
    await enforceDemoEmber(
      req("2.2.2.2"),
      DEMO_IDS.userId,
      "turn",
      "x".repeat(DEMO_EMBER_PROMPT_CHARS),
      limits
    );
  });
  it("limits turns per source, independently per source", async () => {
    for (let i = 0; i < 3; i++)
      await enforceDemoEmber(req("3.3.3.3"), DEMO_IDS.userId, "turn", "hi", limits);
    await expect(
      enforceDemoEmber(req("3.3.3.3"), DEMO_IDS.userId, "turn", "hi", limits)
    ).rejects.toThrow(/Demo limit/);
    await enforceDemoEmber(req("4.4.4.4"), DEMO_IDS.userId, "turn", "hi", limits);
  });
  it("applies a global daily turn ceiling across sources and shows the allowance message", async () => {
    for (let i = 0; i < 5; i++)
      await enforceDemoEmber(req(`9.9.9.${i}`), DEMO_IDS.userId, "turn", "hi", limits);
    await expect(
      enforceDemoEmber(req("9.9.9.99"), DEMO_IDS.userId, "turn", "hi", limits)
    ).rejects.toThrow(/allowance for today is used up/);
  });
  it("limits conversations per source more tightly than turns", async () => {
    await enforceDemoEmber(req("5.5.5.5"), DEMO_IDS.userId, "conversation", undefined, limits);
    await enforceDemoEmber(req("5.5.5.5"), DEMO_IDS.userId, "conversation", undefined, limits);
    await expect(
      enforceDemoEmber(req("5.5.5.5"), DEMO_IDS.userId, "conversation", undefined, limits)
    ).rejects.toThrow(/Demo limit/);
  });
  it("is inert when the kill switch is off", async () => {
    vi.stubEnv("DEMO_MODE_ENABLED", "false");
    for (let i = 0; i < 20; i++)
      await enforceDemoEmber(req("6.6.6.6"), DEMO_IDS.userId, "turn", "hi", limits);
  });
});
