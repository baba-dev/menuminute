import { defineConfig, devices } from "@playwright/test";

const executablePath = process.env["PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH"];
const localBrowser = executablePath ? { launchOptions: { executablePath } } : {};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: process.env["CI"] ? "github" : "html",

  use: {
    baseURL: "https://localhost:3443",
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], ...localBrowser },
    },
    {
      name: "Mobile Chrome",
      use: { ...devices["Pixel 5"], ...localBrowser },
    },
  ],

  webServer: {
    command: "node scripts/browser-server.mjs",
    url: "https://localhost:3443/api/health/ready",
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,

    timeout: 120 * 1000,
  },
});
