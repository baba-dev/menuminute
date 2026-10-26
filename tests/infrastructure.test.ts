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
  expect(() => parseEnv({ ...smtp, SMTP_HOST: "127.0.0.1" })).toThrow("SMTP_HOST");
  expect(
    parseEnv({
      ...smtp,
      APP_URL: "https://localhost:3443",
      DATABASE_URL: "postgresql://app:password@127.0.0.1:5432/menuminute_test",
      SMTP_HOST: "127.0.0.1",
      AUTH_ALLOW_TEST_EMAIL: "true",
    }).SMTP_HOST
  ).toBe("127.0.0.1");
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

it("accepts blank optional R2 settings in local mode but rejects partial R2 setup", () => {
  expect(
    parseMediaEnv({
      MEDIA_STORAGE: "local",
      MEDIA_ROOT: "/tmp/menuminute-media",
      R2_ENDPOINT: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
    }).MEDIA_STORAGE
  ).toBe("local");
  expect(() =>
    parseMediaEnv({
      MEDIA_STORAGE: "r2",
      R2_ENDPOINT: "",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
    })
  ).toThrow("R2_ENDPOINT");
});
