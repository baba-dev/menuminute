#!/usr/bin/env node
// Validate all 36 standalone dish PNG assets.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifestPath = join(root, "docs/food-artwork/manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

if (manifest.assets.length !== 36) {
  throw new Error("Expected exactly 36 manifest entries");
}

const knownPaths = new Set();
const errors = [];

for (const asset of manifest.assets) {
  if (knownPaths.has(asset.path)) {
    errors.push("Duplicate path: " + asset.path);
  }
  knownPaths.add(asset.path);

  const filename = join(root, "public", asset.path.slice(1));
  if (!existsSync(filename)) {
    errors.push("Missing: " + asset.path);
    continue;
  }

  const bytes = readFileSync(filename);
  const signature = bytes.subarray(0, 8).toString("hex");
  const header = bytes.toString("ascii", 12, 16);

  if (bytes.length < 33 || signature !== "89504e470d0a1a0a" || header !== "IHDR") {
    errors.push("Invalid PNG: " + asset.path);
    continue;
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];

  if (width !== 360 || height !== 280 || colorType !== 6) {
    errors.push("Expected 360x280 RGBA PNG: " + asset.path);
  }
}

for (const category of ["indian", "western", "italian"]) {
  const directory = join(root, "public/assets/food/dishes", category);
  if (!existsSync(directory)) {
    errors.push("Missing category directory: " + category);
    continue;
  }
  for (const filename of readdirSync(directory)) {
    const assetPath = "/assets/food/dishes/" + category + "/" + filename;
    if (!knownPaths.has(assetPath)) {
      errors.push("Unexpected file: " + assetPath);
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("Verified 36 named 360x280 RGBA PNG artwork files.");
