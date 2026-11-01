import { describe, expect, it } from "vitest";
import { parseEnv } from "@/lib/config/env";
import { conciergeOutletAllowed } from "@/modules/menu-product/concierge-feature";

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
};

const approvedNvidia = {
  ...base,
  AI_FEATURES_ENABLED: "true",
  AI_NVIDIA_ENABLED: "true",
  AI_NVIDIA_COMMERCIAL_APPROVED: "true",
  NVIDIA_API_KEY: "isolated-test-key",
  AI_NVIDIA_MODEL: "nvidia/nemotron-3.5-super-vl-120b-a12b",
};

describe("public Dining Concierge global publication", () => {
  it("remains off by default, including for outlets in an allowlist", () => {
    const config = parseEnv({ ...base, AI_DINING_CONCIERGE_OUTLET_IDS: "restaurant-1" });
    expect(config.AI_DINING_CONCIERGE_ALL_OUTLETS).toBe(false);
    expect(conciergeOutletAllowed(config, "restaurant-1")).toBe(false);
    expect(conciergeOutletAllowed(config, "restaurant-2")).toBe(false);
  });

  it("preserves the original exact-ID allowlist when global mode is off", () => {
    const config = parseEnv({
      ...approvedNvidia,
      AI_DINING_CONCIERGE_ENABLED: "true",
      AI_DINING_CONCIERGE_OUTLET_IDS: "restaurant-1,restaurant-2",
    });
    expect(conciergeOutletAllowed(config, "restaurant-1")).toBe(true);
    expect(conciergeOutletAllowed(config, "restaurant-2")).toBe(true);
    expect(conciergeOutletAllowed(config, "restaurant-3")).toBe(false);
    expect(conciergeOutletAllowed(config, "*")).toBe(false);
  });

  it("globally allows present and future outlets without a list", () => {
    const config = parseEnv({
      ...approvedNvidia,
      AI_DINING_CONCIERGE_ENABLED: "true",
      AI_DINING_CONCIERGE_ALL_OUTLETS: "true",
    });
    expect(conciergeOutletAllowed(config, "restaurant-1")).toBe(true);
    expect(conciergeOutletAllowed(config, "newly-created-outlet")).toBe(true);
    expect(conciergeOutletAllowed(config, "")).toBe(false);
    // The public menu service still requires a valid published menu / active QR
    // before returning an outlet or showing the Concierge entry.
  });

  it("can revert global mode immediately to the earlier allowlist", () => {
    const config = parseEnv({
      ...approvedNvidia,
      AI_DINING_CONCIERGE_ENABLED: "true",
      AI_DINING_CONCIERGE_ALL_OUTLETS: "false",
      AI_DINING_CONCIERGE_OUTLET_IDS: "restaurant-1",
    });
    expect(conciergeOutletAllowed(config, "restaurant-1")).toBe(true);
    expect(conciergeOutletAllowed(config, "restaurant-2")).toBe(false);
  });

  it("keeps the main Concierge switch as an emergency kill switch", () => {
    const config = parseEnv({
      ...base,
      AI_DINING_CONCIERGE_ENABLED: "false",
      AI_DINING_CONCIERGE_ALL_OUTLETS: "true",
    });
    expect(conciergeOutletAllowed(config, "restaurant-1")).toBe(false);
    expect(conciergeOutletAllowed(config, "future-restaurant")).toBe(false);
  });

  it.each([
    ["AI master disabled", { AI_FEATURES_ENABLED: "false" }],
    ["NVIDIA disabled", { AI_NVIDIA_ENABLED: "false" }],
    ["commercial approval absent", { AI_NVIDIA_COMMERCIAL_APPROVED: "false" }],
    ["missing provider key", { NVIDIA_API_KEY: "" }],
    ["missing model", { AI_NVIDIA_MODEL: "" }],
    ["invalid model name", { AI_NVIDIA_MODEL: "../unsafe" }],
  ])("fails startup for global access if %s", (_description, override) => {
    expect(() =>
      parseEnv({
        ...approvedNvidia,
        AI_DINING_CONCIERGE_ENABLED: "true",
        AI_DINING_CONCIERGE_ALL_OUTLETS: "true",
        ...override,
      })
    ).toThrow(/AI_DINING_CONCIERGE_ALL_OUTLETS/);
  });

  it("rejects malformed global settings rather than silently activating", () => {
    expect(() =>
      parseEnv({
        ...approvedNvidia,
        AI_DINING_CONCIERGE_ENABLED: "true",
        AI_DINING_CONCIERGE_ALL_OUTLETS: "*",
      })
    ).toThrow(/AI_DINING_CONCIERGE_ALL_OUTLETS/);
  });
});
