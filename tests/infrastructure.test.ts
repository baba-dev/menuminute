import { it, expect, afterAll } from "vitest";
import { redisClient, redisHealth, closeRedis } from "../src/lib/redis";
import { parseEnv } from "../src/lib/config/env";
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
