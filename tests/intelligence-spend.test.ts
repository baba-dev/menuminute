import { describe, expect, it } from "vitest";
import { parseEnv } from "../src/lib/config/env";
import { assistantSpendPolicy } from "../src/modules/intelligence/spend";

const configured = (extra: Record<string, string> = {}) =>
  parseEnv({
    NODE_ENV: "test",
    APP_URL: "http://localhost:3000",
    DATABASE_URL: "postgresql://localhost/menuminute_test",
    AUTH_SECRET: "test-only-secret-with-at-least-32-characters",
    EMAIL_PROVIDER: "test",
    AUTH_ALLOW_TEST_EMAIL: "true",
    REDIS_QUEUE_URL: "redis://127.0.0.1:6379",
    REDIS_CACHE_URL: "redis://127.0.0.1:6380",
    MEDIA_STORAGE: "local",
    MEDIA_ROOT: "/tmp/menuminute-test-media",
    AI_FEATURES_ENABLED: "true",
    AI_ORCHESTRATOR_ENABLED: "true",
    AI_NVIDIA_ENABLED: "true",
    AI_NVIDIA_COMMERCIAL_APPROVED: "true",
    NVIDIA_API_KEY: "synthetic-private-key",
    AI_NVIDIA_MODEL: "reviewed/model",
    AI_EMBER_NVIDIA_INPUT_MICROUSD_MTOK: "1000000",
    AI_EMBER_NVIDIA_OUTPUT_MICROUSD_MTOK: "2000000",
    AI_EMBER_NVIDIA_DAILY_CAP_MICROUSD: "20000",
    ...extra,
  });

const messages = [{ role: "user" as const, content: "Summarize the service queue" }];

describe("Ember exact-model monetary admission", () => {
  it("reserves conservatively using actual UTF-8 message bytes and an output cap", () => {
    const config = configured();
    const policy = assistantSpendPolicy(config, "nvidia", "reviewed/model", messages, [], 600);
    const input = Buffer.byteLength(JSON.stringify({ messages, tools: [] }), "utf8") + 4096;
    expect(policy).toEqual({
      reservationMicroUsd: input + 1200,
      dailyCapMicroUsd: 20000,
      inputPriceMicroUsdMtok: 1000000,
      outputPriceMicroUsdMtok: 2000000,
    });
  });

  it("fails closed on missing, malformed or mismatched prices and model identifiers", () => {
    const p = configured();
    expect(() =>
      assistantSpendPolicy(p, "cloudflare", "@cf/reviewed/model", messages, [], 512)
    ).toThrow();
    expect(() => assistantSpendPolicy(p, "nvidia", "different/model", messages, [], 512)).toThrow();
    expect(() =>
      assistantSpendPolicy(
        configured({ AI_EMBER_NVIDIA_INPUT_MICROUSD_MTOK: "" }),
        "nvidia",
        "reviewed/model",
        messages,
        [],
        512
      )
    ).toThrow();
    expect(() =>
      assistantSpendPolicy(
        configured({ AI_EMBER_NVIDIA_DAILY_CAP_MICROUSD: "1" }),
        "nvidia",
        "reviewed/model",
        messages,
        [],
        512
      )
    ).toThrow();
  });

  it("reserves the model-specific output floor and never trusts an arbitrary output limit", () => {
    const config = configured({ AI_NVIDIA_MODEL: "nvidia/nemotron-3.5-super-vl-120b-a12b" });
    const tools = [{ name: "orders.summary", description: "Synthetic bounded tool" }];
    const policy = assistantSpendPolicy(
      config,
      "nvidia",
      "nvidia/nemotron-3.5-super-vl-120b-a12b",
      messages,
      tools,
      600
    );
    const input = Buffer.byteLength(JSON.stringify({ messages, tools }), "utf8") + 4096;
    expect(policy.reservationMicroUsd).toBe(input + 4096);
    expect(() =>
      assistantSpendPolicy(
        config,
        "nvidia",
        "nvidia/nemotron-3.5-super-vl-120b-a12b",
        messages,
        tools,
        9999
      )
    ).toThrow();
  });
});
