import { readFile } from "node:fs/promises";
import vm from "node:vm";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import nextConfig from "../next.config";
import manifest from "../src/app/manifest";

type WorkerPolicy = {
  CACHE_PREFIX: string;
  PRECACHE_URLS: string[];
  classifyRequest(request: {
    method: string;
    mode: string;
    url: string;
    headers: Headers;
  }): "network-only" | "public-navigation" | "public-read" | "static";
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
      "public-navigation"
    );
    expect(policy.classifyRequest(request("/api/public-menu/public-token?lang=hi"))).toBe(
      "public-read"
    );
    expect(policy.classifyRequest(request("/api/public-media/media-id"))).toBe("public-read");
    expect(policy.classifyRequest(request("/_next/static/chunks/app.js"))).toBe("static");
  });

  it.each([
    ["POST order submission", request("/api/orders", { method: "POST" })],
    ["private context API", request("/api/context")],
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
    expect(listeners).toEqual(new Set(["install", "activate", "message", "fetch"]));
    expect(listeners.has("sync")).toBe(false);
    expect(policy.CACHE_PREFIX).toBe("menuminute-pwa-v1-");
    expect(policy.PRECACHE_URLS).toContain("/offline");
    expect(
      policy.responseCanBeCached(
        new Response("private", { headers: { vary: "Cookie" }, status: 200 })
      )
    ).toBe(false);
    expect(policy.responseCanBeCached(new Response("public", { status: 200 }))).toBe(true);
  });
});
