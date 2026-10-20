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

it("accepts only complete secure production SMTP configuration", () => {
  const smtp = {
    ...process.env,
    NODE_ENV: "production",
    APP_URL: "https://food.bababuilds.com",
    DATABASE_URL: "postgresql://app:password@127.0.0.1:5432/menuminute",
    REDIS_QUEUE_URL: "redis://127.0.0.1:6381",
    REDIS_CACHE_URL: "redis://127.0.0.1:6382",
    AUTH_SECRET: "a92c809411966d26b5fe736b74e24dfde93d1e1d",
    EMAIL_PROVIDER: "smtp",
    EMAIL_FROM: "food@bababuilds.com",
    SMTP_HOST: "mx.bababuilds.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "food@bababuilds.com",
    SMTP_PASSWORD: "private-ci-placeholder",
    AUTH_ALLOW_TEST_EMAIL: "false",
  };
  expect(parseEnv(smtp)).toMatchObject({
    EMAIL_PROVIDER: "smtp",
    SMTP_PORT: 465,
    SMTP_SECURE: true,
  });
  for (const name of ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASSWORD"]) {
    expect(() => parseEnv({ ...smtp, [name]: undefined })).toThrow(name);
  }
  expect(() => parseEnv({ ...smtp, SMTP_PORT: "65536" })).toThrow("SMTP_PORT");
  expect(() => parseEnv({ ...smtp, SMTP_SECURE: "yes" })).toThrow("SMTP_SECURE");
  expect(() => parseEnv({ ...smtp, SMTP_SECURE: "false" })).toThrow("SMTP_SECURE");
  expect(() => parseEnv({ ...smtp, EMAIL_FROM: "not-an-address" })).toThrow("EMAIL_FROM");
  expect(() => parseEnv({ ...smtp, EMAIL_PROVIDER: "test" })).toThrow("EMAIL_PROVIDER");
  expect(() => parseEnv({ ...smtp, SMTP_PASSWORD: "" })).toThrow("SMTP_PASSWORD");
});
