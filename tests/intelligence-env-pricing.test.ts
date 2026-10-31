import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/config/env";

const base = {
  NODE_ENV: "test",
  APP_URL: "http://localhost:3000",
  DATABASE_URL: "postgresql://localhost/menuminute_test",
  AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
  AUTH_ALLOW_TEST_EMAIL: "true",
  EMAIL_PROVIDER: "test",
  REDIS_QUEUE_URL: "redis://127.0.0.1:6379",
  REDIS_CACHE_URL: "redis://127.0.0.1:6380",
  MEDIA_STORAGE: "local",
  MEDIA_ROOT: "/tmp/menuminute-test-media",
  AI_FEATURES_ENABLED: "true",
  AI_ORCHESTRATOR_ENABLED: "true",
  AI_ASSISTANT_READ_ONLY_ENABLED: "true",
  AI_CLOUDFLARE_ENABLED: "true",
  AI_CLOUDFLARE_TOOLS_VERIFIED: "true",
  AI_CLOUDFLARE_MODEL: "@cf/reviewed/model",
  CLOUDFLARE_ACCOUNT_ID: "a".repeat(32),
  CLOUDFLARE_API_TOKEN: "synthetic-token",
};
const pricing = {
  AI_EMBER_CLOUDFLARE_INPUT_MICROUSD_MTOK: "1000",
  AI_EMBER_CLOUDFLARE_OUTPUT_MICROUSD_MTOK: "2000",
  AI_EMBER_CLOUDFLARE_DAILY_CAP_MICROUSD: "1000000",
};

describe("Ember pricing configuration", () => {
  it("refuses to boot with Ember enabled but pricing/cap unset", () => {
    expect(() => parseEnv(base)).toThrow(/AI_EMBER_CLOUDFLARE_INPUT_MICROUSD_MTOK/);
  });

  it("treats blank pricing values as unset", () => {
    expect(() =>
      parseEnv({ ...base, ...pricing, AI_EMBER_CLOUDFLARE_DAILY_CAP_MICROUSD: "" })
    ).toThrow(/AI_EMBER_CLOUDFLARE_DAILY_CAP_MICROUSD/);
  });

  it("boots when pricing and cap are set", () => {
    expect(parseEnv({ ...base, ...pricing }).AI_EMBER_CLOUDFLARE_DAILY_CAP_MICROUSD).toBe(1000000);
  });

  it("does not require pricing while Ember is off", () => {
    expect(() =>
      parseEnv({
        ...base,
        AI_ASSISTANT_READ_ONLY_ENABLED: "false",
        AI_ASSISTANT_ACTIONS_ENABLED: "false",
      })
    ).not.toThrow();
  });
});
