#!/usr/bin/env node
// Captures User Guide screenshots from a running app with the demo tenant (see docs/demo.md).
//   GUIDE_CAPTURE_BASE=http://localhost:3000 node scripts/guide/capture.mjs [shotId ...]
// Local-only: sends x-real-ip because the demo entry limiter expects the reverse proxy's header.
// Output: public/guide/shots/<id>-<desktop|mobile>.webp. Uses demo sample data only.
import { chromium } from "@playwright/test";
import sharp from "sharp";
import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHOTS } from "./shots.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const outDir = join(root, "public/guide/shots");
const base = (process.env["GUIDE_CAPTURE_BASE"] ?? "http://localhost:3000").replace(/\/$/, "");
const only = new Set(process.argv.slice(2));
const executablePath =
  process.env["CHROMIUM_PATH"] ??
  (existsSync("/opt/pw-browsers/chromium") ? "/opt/pw-browsers/chromium" : undefined);
mkdirSync(outDir, { recursive: true });

const VIEWS = {
  desktop: { viewport: { width: 1440, height: 900 }, scale: 1, out: 1400 },
  mobile: { viewport: { width: 390, height: 844 }, scale: 2, out: 780 },
};

const marksOut = {};
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
for (const [view, cfg] of Object.entries(VIEWS)) {
  const context = await browser.newContext({
    viewport: cfg.viewport,
    deviceScaleFactor: cfg.scale,
    reducedMotion: "reduce",
    colorScheme: "light",
    isMobile: view === "mobile",
    hasTouch: view === "mobile",
    extraHTTPHeaders: { "x-real-ip": "127.0.0.1" },
  });
  await context.addInitScript(() => {
    try {
      localStorage.setItem("menuminute.appearance", "light");
    } catch {}
    const style = document.createElement("style");
    style.textContent =
      "nextjs-portal,[data-nextjs-toast],[data-next-badge-root]{display:none!important}";
    document.addEventListener("DOMContentLoaded", () => document.head.appendChild(style));
  });
  const page = await context.newPage();
  let signedIn = false;
  for (const shot of SHOTS) {
    if (only.size && !only.has(shot.id)) continue;
    if (shot.views && !shot.views.includes(view)) continue;
    if (shot.auth && !signedIn) {
      await page.goto(base + "/demo", { waitUntil: "domcontentloaded", timeout: 120000 });
      await Promise.all([
        page.waitForURL(/\/dashboard/, { timeout: 120000 }),
        page.click('button:has-text("Enter the Demo Dashboard")'),
      ]);
      signedIn = true;
    }
    try {
      await page.goto(base + shot.path, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(shot.settle ?? 4500);
      // The shared demo banner is not part of a real restaurant's screen.
      await page.evaluate(() => {
        const hit = [...document.querySelectorAll("div,header,section")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            return (
              e.textContent?.includes("Shared by all visitors") &&
              r.width > innerWidth * 0.5 &&
              r.height < 120
            );
          })
          .pop();
        if (hit) hit.style.display = "none";
      });
      if (shot.prepare) await shot.prepare(page, view);
      await page.waitForTimeout(700);
      const clip = shot.clip?.(view);
      if (shot.marks) {
        const area = clip ?? { x: 0, y: 0, ...cfg.viewport };
        const list = [];
        for (const m of shot.marks(page, view)) {
          let box = null;
          for (const el of await m.loc.all()) {
            if (!(await el.isVisible().catch(() => false))) continue;
            const b = await el.boundingBox().catch(() => null);
            if (b && b.width > 4 && b.height > 4) {
              box = b;
              break;
            }
          }
          if (!box) {
            console.error("  mark not found", shot.id, view, m.n);
            continue;
          }
          list.push({
            n: m.n,
            x: ((box.x - area.x) / area.width) * 100,
            y: ((box.y - area.y) / area.height) * 100,
            w: (box.width / area.width) * 100,
            h: (box.height / area.height) * 100,
          });
        }
        marksOut[`${shot.id}-${view}`] = list;
      }
      const png = await page.screenshot({ type: "png", ...(clip ? { clip } : {}) });
      await sharp(png)
        .resize({ width: cfg.out, withoutEnlargement: true })
        .webp({ quality: 84 })
        .toFile(join(outDir, `${shot.id}-${view}.webp`));
      console.log("captured", shot.id, view);
    } catch (e) {
      console.error("FAILED", shot.id, view, e instanceof Error ? e.message.split("\n")[0] : e);
    }
  }
  await context.close();
}
const marksFile = join(outDir, "marks.json");
let prev = {};
try {
  prev = JSON.parse((await import("node:fs")).readFileSync(marksFile, "utf8"));
} catch {}
// Prettier style (2-space indent, trailing newline) so `prettier --check .` passes in CI.
writeFileSync(marksFile, JSON.stringify({ ...prev, ...marksOut }, null, 2) + "\n");
await browser.close();
