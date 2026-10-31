import { expect, test } from "@playwright/test";

// Service-worker script fetches do not inherit Playwright's context-level ignoreHTTPSErrors setting.
// This flag is limited to the isolated self-signed browser fixture; production TLS stays enforced.
test.use({
  launchOptions: {
    ...(process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"]
      ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"] }
      : {}),
    args: ["--ignore-certificate-errors"],
  },
});

test.describe("Progressive Web App", () => {
  test("publishes install metadata and registers a root worker", async ({ page, request }) => {
    const manifestResponse = await request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBe(true);
    expect(manifestResponse.headers()["content-type"]).toContain("application/manifest+json");
    const manifest = await manifestResponse.json();
    expect(manifest).toMatchObject({
      short_name: "MenuMinute",
      display: "standalone",
      scope: "/",
      start_url: "/?source=pwa",
    });

    for (const icon of manifest.icons as Array<{ src: string }>) {
      const response = await request.get(icon.src);
      expect(response.ok()).toBe(true);
      expect(response.headers()["content-type"]).toContain("image/png");
    }

    const workerResponse = await request.get("/sw.js");
    expect(workerResponse.ok()).toBe(true);
    expect(workerResponse.headers()["service-worker-allowed"]).toBe("/");
    expect(workerResponse.headers()["cache-control"]).toContain("no-store");

    await page.goto("/");
    const scope = await page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return registration.scope;
    });
    expect(new URL(scope).pathname).toBe("/");
  });

  test("falls back only for cached public reads while offline", async ({ page, context }) => {
    await page.goto("/m/demo-spice-route-kitchen-v1");
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    await expect(page.getByText(/Available offline · last synced/)).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Spice Route Kitchen");

    const publicResponse = await page.request.get("/api/public-menu/demo-spice-route-kitchen-v1");
    expect(publicResponse.ok()).toBe(true);
    await page.evaluate(async () => {
      const response = await fetch("/api/public-menu/demo-spice-route-kitchen-v1", {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("public menu was not cached");
    });

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Spice Route Kitchen");
    await expect(
      page.getByText("You're offline. Live actions and ordering are unavailable.")
    ).toBeVisible();
    await expect(page.getByText("Viewing a saved menu")).toBeVisible();
    await expect(page.getByText(/Ordering is paused until you reconnect/)).toBeVisible();

    const results = await page.evaluate(async () => {
      const publicRead = await fetch("/api/public-menu/demo-spice-route-kitchen-v1").then(
        (response) => response.ok,
        () => false
      );
      const privateRead = await fetch("/api/context").then(
        () => true,
        () => false
      );
      const mutation = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }).then(
        () => true,
        () => false
      );
      return { mutation, privateRead, publicRead };
    });
    expect(results).toEqual({ mutation: false, privateRead: false, publicRead: true });
  });
});
