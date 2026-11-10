#!/usr/bin/env node
/**
 * Capture actual mobile-viewport screenshots from the public MenuMinute demo,
 * without passwords or write operations. These are unmodified page captures.
 *
 * PLAY_CAPTURE_BASE=https://food.bababuilds.com node scripts/demo/capture-play-store.mjs
 */
import { chromium } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const BASE = (process.env.PLAY_CAPTURE_BASE ?? "https://food.bababuilds.com").replace(/\/$/, "");
const OUTPUT = resolve(process.env.PLAY_CAPTURE_OUTPUT ?? "play-store-demo-screenshots");
const origin = new URL(BASE);
if (origin.protocol !== "https:" || origin.hostname !== "food.bababuilds.com") {
  throw new Error("Capture is restricted to the public production MenuMinute demo");
}
const shots = [
  { id: "01-dashboard", title: "Restaurant dashboard", path: "/dashboard" },
  { id: "02-menu-studio", title: "Digital menu studio", path: "/dashboard/menu" },
  { id: "03-pos", title: "Point of sale", path: "/dashboard/pos" },
  { id: "04-orders", title: "Orders", path: "/dashboard/orders" },
  { id: "05-kitchen", title: "Kitchen display", path: "/kitchen" },
  { id: "06-qr-studio", title: "QR menu studio", path: "/dashboard/qr-codes" },
  { id: "07-guest-qr-menu", title: "Guest-facing QR menu", path: "/m/demo-spice-route-kitchen-v2" },
];

mkdirSync(OUTPUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ["--no-sandbox"],
  executablePath: process.env.CHROMIUM_PATH || undefined,
});
try {
  const context = await browser.newContext({
    viewport: { width: 360, height: 640 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    reducedMotion: "reduce",
    locale: "en-US",
    timezoneId: "Asia/Kolkata",
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("menuminute.appearance", "light");
    } catch {
      /* Demo must work with localStorage disabled. */
    }
  });
  const page = await context.newPage();
  await page.goto(BASE + "/demo", { waitUntil: "domcontentloaded", timeout: 90000 });
  await Promise.all([
    page.waitForURL(/\/dashboard(?:\/|\?|$)/, { timeout: 90000 }),
    page.locator('button:has-text("Enter the Demo Dashboard")').click({ timeout: 30000 }),
  ]);
  if (new URL(page.url()).pathname !== "/dashboard") {
    throw new Error("Failed to enter public demo dashboard");
  }

  const captured = [];
  for (const shot of shots) {
    await page.goto(BASE + shot.path, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => undefined);
    await page.evaluate(async () => {
      await document.fonts?.ready;
    });
    await page.waitForTimeout(4500);
    const urlPath = new URL(page.url()).pathname;
    if (urlPath !== shot.path) {
      throw new Error("Unexpected redirect capturing " + shot.id + ": " + urlPath);
    }
    const pageTitle = await page.title();
    if ((await page.locator("body").innerText()).length < 140) {
      throw new Error("Insufficient visible demo content for " + shot.id);
    }
    const png = await page.screenshot({ type: "png", fullPage: false, animations: "disabled" });
    const width = png.readUInt32BE(16);
    const height = png.readUInt32BE(20);
    if (width !== 1080 || height !== 1920) {
      throw new Error("Unexpected capture dimensions for " + shot.id);
    }
    const filename = shot.id + ".png";
    writeFileSync(join(OUTPUT, filename), png);
    captured.push({
      filename,
      screen: shot.title,
      route: shot.path,
      dimensions: String(width) + "x" + String(height),
      bytes: png.length,
      sha256: createHash("sha256").update(png).digest("hex"),
      pageTitle,
    });
    console.log("Captured " + filename + ": " + width + "x" + height + " (" + Math.round(png.length / 1024) + " KiB)");
  }
  writeFileSync(
    join(OUTPUT, "manifest.json"),
    JSON.stringify(
      {
        source: BASE + "/demo",
        capturedAt: new Date().toISOString(),
        type: "real demo screenshots in mobile Chromium, not native TWA",
        screenshots: captured,
      },
      null,
      2
    ) + "\n"
  );
  writeFileSync(
    join(OUTPUT, "README.txt"),
    [
      "MenuMinute - Google Play demo-route mobile screenshots",
      "",
      "Source: " + BASE + "/demo",
      "Shows public sample restaurant Spice Route Kitchen, NOT private The Droid Pie.",
      "Unmodified captures of actual live pages at 360x640 CSS pixels, DPR 3.",
      "Each PNG is 1080x1920, Google Play phone screenshot dimensions.",
      "",
      "Suggested order:",
      ...shots.map((s) => s.id + ".png - " + s.title),
      "",
      "Review each image for loader, errors or demo restrictions before uploading.",
      "For native-only behavior, use verified screenshots from the signed Android app.",
      "",
    ].join("\n")
  );
  await context.close();
} finally {
  await browser.close();
}
