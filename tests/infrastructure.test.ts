import { it, expect, afterAll } from "vitest";
import { redisClient, redisHealth, closeRedis } from "../src/lib/redis";
import { parseEnv } from "../src/lib/config/env";
import { parseMediaEnv } from "../src/lib/config/media-env";
import { consumePublicMediaLimit } from "../src/lib/public-rate-limit";
afterAll(closeRedis);
it("keeps queue/cache policies and data physically separate", async () => {
  const queue = await redisClient("queue"),
    cache = await redisClient("cache");
  expect((await queue.configGet("maxmemory-policy"))["maxmemory-policy"]).toBe("noeviction");
  expect((await cache.configGet("maxmemory-policy"))["maxmemory-policy"]).toBe("allkeys-lru");
  const key = crypto.randomUUID();
  await queue.set(key, "queue-only");
  expect(await cache.get(key)).toBeNull();
  await queue.del(key);
  expect(await redisHealth()).toEqual({ queue: true, cache: true });
});
it("fails configuration without secrets, PostgreSQL or separate Redis", () => {
  const base: Record<string, string | undefined> = {
    ...process.env,
    NODE_ENV: "production",
    APP_URL: "https://menu.invalid",
    AUTH_SECRET: "a92c809411966d26b5fe736b74e24dfde93d1e1d",
  };
  expect(() => parseEnv({ ...base, AUTH_SECRET: undefined })).toThrow();
  expect(() => parseEnv({ ...base, DATABASE_URL: "./data/old.sqlite" })).toThrow();
  expect(() => parseEnv({ ...base, REDIS_CACHE_URL: base.REDIS_QUEUE_URL })).toThrow();
  expect(() => parseEnv({ ...base, APP_URL: "http://menu.invalid" })).toThrow();
});

it("fails media configuration at startup and applies the R2 bucket default", () => {
  expect(() =>
    parseMediaEnv({
      MEDIA_STORAGE: "local",
      MEDIA_ROOT: "relative/media",
      MEDIA_OUTLET_BUDGET_BYTES: "104857600",
    })
  ).toThrow("MEDIA_ROOT");
  expect(() =>
    parseMediaEnv({
      MEDIA_STORAGE: "r2",
      MEDIA_OUTLET_BUDGET_BYTES: "104857600",
    })
  ).toThrow("R2_ENDPOINT");
  expect(
    parseMediaEnv({
      MEDIA_STORAGE: "r2",
      MEDIA_OUTLET_BUDGET_BYTES: "104857600",
      R2_ENDPOINT: "https://isolated-account.r2.cloudflarestorage.com/",
      R2_ACCESS_KEY_ID: "access",
      R2_SECRET_ACCESS_KEY: "secret",
    }).R2_BUCKET_NAME
  ).toBe("menuminute-media");
});

it("bounds anonymous public media work with the cache Redis instance", async () => {
  const identity = `test-${crypto.randomUUID()}`;
  let decision = await consumePublicMediaLimit(identity);
  expect(decision.allowed).toBe(true);
  for (let count = 1; count <= decision.limit; count++) {
    decision = await consumePublicMediaLimit(identity);
  }
  expect(decision.allowed).toBe(false);
  expect(decision.remaining).toBe(0);
  expect(decision.retryAfterSeconds).toBeGreaterThan(0);
});
