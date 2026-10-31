#!/usr/bin/env node
// Verifies the committed documentation screenshots against public/docs-media/manifest.json and the
// guide content (every referenced screenshot id has desktop-light, desktop-dark and mobile-light files).
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const dir = join(root, "public/docs-media");
const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8"));
const errors = [];
const MAX_TOTAL = 12 * 1024 * 1024;
const MAX_FILE = 400 * 1024;
let total = 0;

for (const [file, meta] of Object.entries(manifest.shots)) {
  const path = join(dir, file);
  if (!existsSync(path)) {
    errors.push("Missing screenshot: " + file);
    continue;
  }
  const bytes = readFileSync(path);
  total += bytes.length;
  if (bytes.length !== meta.bytes) errors.push("Size differs from manifest: " + file);
  if (createHash("sha256").update(bytes).digest("hex") !== meta.sha256)
    errors.push("Checksum differs from manifest: " + file);
  if (bytes.length > MAX_FILE)
    errors.push("Screenshot too large (" + bytes.length + " bytes): " + file);
  if (
    bytes.subarray(0, 4).toString("latin1") !== "RIFF" ||
    bytes.subarray(8, 12).toString("latin1") !== "WEBP"
  )
    errors.push("Not a WebP file: " + file);
}
for (const file of readdirSync(dir)) {
  if (file !== "manifest.json" && !manifest.shots[file]) errors.push("Unlisted file: " + file);
}
if (total > MAX_TOTAL) errors.push("Documentation media exceeds budget: " + total);

const { SHOTS, VARIANTS } = await import("./demo/docs-shots.mjs");
for (const shot of SHOTS)
  for (const variant of VARIANTS)
    if (!manifest.shots[`${shot.id}-${variant.key}.webp`])
      errors.push(`Shot ${shot.id} has no ${variant.key} capture`);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Verified ${Object.keys(manifest.shots).length} documentation screenshots (${Math.round(total / 1024)} KB).`
);
