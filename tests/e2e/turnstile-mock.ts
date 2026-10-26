import type { Page } from "@playwright/test";

/**
 * Isolated browser tests use a synthetic Turnstile client, not Cloudflare's
 * production-hostname widget. The CI auth server has no Turnstile secret and
 * never accepts this synthetic token in production.
 */
export async function mockTurnstileForBrowserTests(page: Page) {
  await page.route("https://challenges.cloudflare.com/turnstile/v0/api.js*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: `window.turnstile = {
        render: (_container, options) => {
          options.callback("synthetic-browser-test-token");
          return "ci-test-widget";
        }
      };`,
    })
  );
}
