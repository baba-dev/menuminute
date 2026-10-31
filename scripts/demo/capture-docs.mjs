#!/usr/bin/env node
// Captures the documentation screenshots from a running app that has the demo tenant provisioned and
// DEMO_MODE_ENABLED=true (see docs/demo.md). Output: public/docs-media/*.webp + manifest.json.
//   DOCS_CAPTURE_BASE=http://localhost:3000 node scripts/demo/capture-docs.mjs [shotId ...]
// The dev/prod server only needs to be reachable; chromium is launched headless. Deterministic apart
// from the live demo clock (order ages), so re-capture whenever the UI changes.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHOTS, VARIANTS } from "./docs-shots.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const outDir = join(root, "public/docs-media");
const base = (process.env["DOCS_CAPTURE_BASE"] ?? "http://localhost:3000").replace(/\/$/, "");
const only = new Set(process.argv.slice(2));
const executablePath =
  process.env["CHROMIUM_PATH"] ??
  (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
const manifestPath = join(outDir, "manifest.json");
const previous = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : { shots: {} };
const manifest = { version: 1, shots: { ...previous.shots } };

async function enterDemo(page) {
  await page.goto(base + "/demo", { waitUntil: "domcontentloaded" });
  await Promise.all([
    page.waitForURL(/\/dashboard/, { timeout: 90000 }),
    page.click('button:has-text("Enter the Demo Dashboard")'),
  ]);
}

for (const variant of VARIANTS) {
  const context = await browser.newContext({
    viewport: variant.viewport,
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
    colorScheme: variant.theme,
  });
  await context.addInitScript((theme) => {
    try {
      localStorage.setItem("menuminute.appearance", theme);
    } catch {}
  }, variant.theme);
  // Hide the Next.js dev overlay/indicator when capturing from `next dev`.
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent =
      "nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  });
  const page = await context.newPage();
  let signedIn = false;
  for (const shot of SHOTS) {
    if (only.size && !only.has(shot.id)) continue;
    if (variant.only && !variant.only.includes(shot.id) && variant.only !== "all") continue;
    if (shot.auth && !signedIn) {
      await enterDemo(page);
      signedIn = true;
    }
    await page.goto(base + shot.path, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(shot.settle ?? 3500);
    if (shot.prepare) await shot.prepare(page, variant);
    await page.waitForTimeout(600);
    const png = await page.screenshot({ type: "png", fullPage: false });
    const file = `${shot.id}-${variant.key}.webp`;
    const image = sharp(png);
    const resized = variant.width ? image.resize({ width: variant.width }) : image;
    const { data, info } = await resized
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });
    writeFileSync(join(outDir, file), data);
    manifest.shots[file] = {
      id: shot.id,
      variant: variant.key,
      width: info.width,
      height: info.height,
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex"),
    };
    console.log(
      "captured",
      file,
      `${info.width}x${info.height}`,
      `${Math.round(data.length / 1024)}KB`
    );
  }
  await context.close();
}
await browser.close();
const sorted = Object.fromEntries(
  Object.entries(manifest.shots).sort(([a], [b]) => a.localeCompare(b))
);
writeFileSync(manifestPath, JSON.stringify({ version: 1, shots: sorted }, null, 2) + "\n");
