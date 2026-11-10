import { describe, expect, it, vi } from "vitest";

const cookie = vi.hoisted(() => ({ value: null as string | null }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "menuminute.play_client" && cookie.value !== null
        ? { value: cookie.value }
        : undefined,
  }),
}));

import { isPlayClient, PLAY_CLIENT_COOKIE } from "../src/lib/app-distribution";
import { GET as appLaunch } from "../src/app/api/app/launch/route";
import { GET as assetLinks } from "../src/app/.well-known/assetlinks.json/route";

describe("Play consumption-only distribution", () => {
  it("recognizes only the exact cookie marker and never treats it as an auth signal", async () => {
    expect(PLAY_CLIENT_COOKIE).toBe("menuminute.play_client");
    cookie.value = null;
    expect(await isPlayClient()).toBe(false);
    cookie.value = "0";
    expect(await isPlayClient()).toBe(false);
    cookie.value = "1";
    expect(await isPlayClient()).toBe(true);
    cookie.value = null;
  });

  it("sets a secure, HttpOnly, SameSite cookie and redirects to server-side merchant auth", () => {
    const response = appLaunch(new Request("https://food.bababuilds.com/api/app/launch"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/app");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("Secure");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("never leaks the internal listener origin (regression: TWA opened https://localhost:3100)", () => {
    // Behind Nginx, Next builds request.url from HOSTNAME/PORT (127.0.0.1:3100), not from Host.
    for (const internal of [
      "https://localhost:3100/api/app/launch",
      "http://127.0.0.1:3100/api/app/launch",
    ]) {
      const location = appLaunch(new Request(internal)).headers.get("location");
      expect(location).toBe("/app");
      expect(location).not.toMatch(/localhost|127\.0\.0\.1|:\d{2,5}/);
    }
  });

  it("publishes no unverified Digital Asset Links placeholder", async () => {
    const prior = process.env.ANDROID_PLAY_APP_SIGNING_SHA256;
    try {
      delete process.env.ANDROID_PLAY_APP_SIGNING_SHA256;
      expect((await assetLinks()).status).toBe(503);
      process.env.ANDROID_PLAY_APP_SIGNING_SHA256 = Array(32).fill("AB").join(":");
      const response = await assetLinks();
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data[0].target.package_name).toBe("com.bababuilds.menuminute");
      expect(data[0].target.sha256_cert_fingerprints).toEqual([Array(32).fill("AB").join(":")]);
    } finally {
      if (prior === undefined) delete process.env.ANDROID_PLAY_APP_SIGNING_SHA256;
      else process.env.ANDROID_PLAY_APP_SIGNING_SHA256 = prior;
    }
  });
});
