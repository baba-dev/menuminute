import { readFile } from "node:fs/promises";
import vm from "node:vm";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import manifest from "../src/app/manifest";
import { parseEnv } from "../src/lib/config/env";

type WorkerPolicy = {
  CACHE_PREFIX: string;
  PRECACHE_URLS: string[];
  classifyRequest(request: {
    method: string;
    mode: string;
    url: string;
    headers: Headers;
  }):
    | "network-only"
    | "public-navigation"
    | "guest-navigation"
    | "guest-read"
    | "guest-media"
    | "static";
  parseGuestEnrollment(
    data: unknown,
    clientUrl: string
  ): { enabled: boolean; pageUrl: string; apiUrl: string; syncedAt: string } | null;
  responseCanBeCached(response: Response): boolean;
};

async function loadWorkerPolicy() {
  const source = await readFile(new URL("../public/sw.js", import.meta.url), "utf8");
  const listeners = new Set<string>();
  const worker = {
    location: { origin: "https://food.bababuilds.com" },
    addEventListener(type: string) {
      listeners.add(type);
    },
  } as { __MENUMINUTE_PWA_TEST__?: WorkerPolicy } & Record<string, unknown>;

  vm.runInNewContext(source, {
    Headers,
    Object,
    Promise,
    Set,
    URL,
    self: worker,
  });

  if (!worker.__MENUMINUTE_PWA_TEST__) throw new Error("PWA policy was not exposed to tests");
  return { listeners, policy: worker.__MENUMINUTE_PWA_TEST__ };
}

function request(
  path: string,
  options: { method?: string; mode?: string; headers?: Record<string, string> } = {}
) {
  return {
    method: options.method ?? "GET",
    mode: options.mode ?? "cors",
    url: new URL(path, "https://food.bababuilds.com").href,
    headers: new Headers(options.headers),
  };
}

describe("PWA install metadata", () => {
  it("publishes a scoped standalone manifest with purpose-specific icons", () => {
    const value = manifest();
    expect(value).toMatchObject({
      id: "/",
      short_name: "MenuMinute",
      start_url: "/?source=pwa",
      scope: "/",
      display: "standalone",
      theme_color: "#f97316",
    });
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "any" }),
        expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
      ])
    );
  });

  it.each([
    ["apple-touch-icon-180.png", 180, false],
    ["icon-192.png", 192, true],
    ["icon-512.png", 512, true],
    ["icon-maskable-512.png", 512, false],
  ])("ships a valid %s asset", async (name, size, hasAlpha) => {
    const metadata = await sharp(
      new URL(`../public/brand/icons/pwa/${name}`, import.meta.url).pathname
    ).metadata();
    expect(metadata).toMatchObject({
      width: size,
      height: size,
      format: "png",
      hasAlpha,
    });
  });

  it("serves a root-scoped, non-persistently-cached worker", async () => {
    if (typeof nextConfig.headers !== "function") throw new Error("headers config missing");
    const rules = await nextConfig.headers();
    const workerRule = rules.find((rule) => rule.source === "/sw.js");
    expect(workerRule?.headers).toEqual(
      expect.arrayContaining([
        { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        { key: "Service-Worker-Allowed", value: "/" },
      ])
    );
  });
});

describe("PWA cache policy", () => {
  it("allows only explicit anonymous public reads", async () => {
    const { policy } = await loadWorkerPolicy();
    expect(policy.classifyRequest(request("/", { mode: "navigate" }))).toBe("public-navigation");
    expect(policy.classifyRequest(request("/m/public-token", { mode: "navigate" }))).toBe(
      "guest-navigation"
    );
    expect(policy.classifyRequest(request("/api/public-menu/public-token?lang=hi"))).toBe(
      "guest-read"
    );
    expect(policy.classifyRequest(request("/api/public-media/media-id"))).toBe("guest-media");
    expect(policy.classifyRequest(request("/_next/static/chunks/app.js"))).toBe("static");
  });

  it.each([
    ["POST order submission", request("/api/orders", { method: "POST" })],
    ["private context API", request("/api/context")],
    ["private device alerts GET", request("/api/pwa/push")],
    ["private device alerts POST", request("/api/pwa/push", { method: "POST" })],
    ["dashboard navigation", request("/dashboard", { mode: "navigate" })],
    ["kitchen navigation", request("/kitchen", { mode: "navigate" })],
    ["admin navigation", request("/admin", { mode: "navigate" })],
    [
      "cross-origin GET",
      { ...request("https://example.com/menu"), url: "https://example.com/menu" },
    ],
    ["range request", request("/assets/video.mp4", { headers: { range: "bytes=0-10" } })],
  ])("keeps %s network-only", async (_label, candidate) => {
    const { policy } = await loadWorkerPolicy();
    expect(policy.classifyRequest(candidate)).toBe("network-only");
  });

  it("does not register background sync and rejects personalized responses", async () => {
    const { listeners, policy } = await loadWorkerPolicy();
    expect(listeners).toEqual(
      new Set(["install", "activate", "message", "fetch", "push", "notificationclick"])
    );
    expect(listeners.has("sync")).toBe(false);
    expect(policy.CACHE_PREFIX).toBe("menuminute-pwa-v2-");
    expect(policy.PRECACHE_URLS).toContain("/offline");
    expect(
      policy.responseCanBeCached(
        new Response("private", { headers: { vary: "Cookie" }, status: 200 })
      )
    ).toBe(false);
    expect(policy.responseCanBeCached(new Response("public", { status: 200 }))).toBe(true);
  });

  it("accepts only same-origin, same-token guest enrollment from the matching menu client", async () => {
    const { policy } = await loadWorkerPolicy();
    const data = {
      type: "SET_GUEST_OFFLINE",
      enabled: true,
      pagePath: "/m/public-token?lang=hi",
      apiPath: "/api/public-menu/public-token?lang=hi",
    };
    expect(
      policy.parseGuestEnrollment(data, "https://food.bababuilds.com/m/public-token?lang=hi")
    ).toMatchObject({
      enabled: true,
      pageUrl: "https://food.bababuilds.com/m/public-token?lang=hi",
      apiUrl: "https://food.bababuilds.com/api/public-menu/public-token?lang=hi",
    });
    expect(
      policy.parseGuestEnrollment(
        { ...data, apiPath: "/api/public-menu/another-token?lang=hi" },
        "https://food.bababuilds.com/m/public-token?lang=hi"
      )
    ).toBeNull();
    expect(
      policy.parseGuestEnrollment(data, "https://food.bababuilds.com/m/another-token?lang=hi")
    ).toBeNull();
    expect(
      policy.parseGuestEnrollment(
        { ...data, apiPath: "/api/public-menu/public-token" },
        "https://food.bababuilds.com/m/public-token?lang=hi"
      )
    ).toMatchObject({ apiUrl: "https://food.bababuilds.com/api/public-menu/public-token" });
    expect(
      policy.parseGuestEnrollment(
        { ...data, pagePath: "https://evil.example/m/public-token?lang=hi" },
        "https://food.bababuilds.com/m/public-token?lang=hi"
      )
    ).toBeNull();
  });
});

describe("PWA operational rollout configuration", () => {
  it("requires a bounded unique allowlist when the master gate is enabled", () => {
    const enabled = parseEnv({
      ...process.env,
      PWA_OPERATIONAL_ENABLED: "true",
      PWA_OPERATIONAL_OUTLET_IDS: "demo-outlet, second-outlet",
    });
    expect(enabled.PWA_OPERATIONAL_OUTLET_IDS).toEqual(["demo-outlet", "second-outlet"]);
    expect(() =>
      parseEnv({
        ...process.env,
        PWA_OPERATIONAL_ENABLED: "true",
        PWA_OPERATIONAL_OUTLET_IDS: "",
      })
    ).toThrow("PWA_OPERATIONAL_OUTLET_IDS");
    expect(() =>
      parseEnv({
        ...process.env,
        PWA_OPERATIONAL_ENABLED: "true",
        PWA_OPERATIONAL_OUTLET_IDS: "demo-outlet,demo-outlet",
      })
    ).toThrow("PWA_OPERATIONAL_OUTLET_IDS");
  });
});
