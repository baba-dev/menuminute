#!/usr/bin/env node
// Validate the individually named dish artwork PNGs in the review branch.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../../", import.meta.url));
const manifest = JSON.parse(readFileSync(join(root, "docs/food-artwork/manifest.json"), "utf8"));
const errors = [];
const runtimeArt = JSON.parse(
  readFileSync(join(root, "src/data/approved-dish-artwork.json"), "utf8")
);
const groups = Object.entries(manifest.groups);
const thirdGroups = new Set([
  "bengal-odisha-delights",
  "bihar-jharkhand-classics",
  "northeast-treasures",
  "himalayan-comforts",
  "indo-chinese-starters-ii",
]);

if (manifest.assetCount !== 224 || manifest.assets.length !== manifest.assetCount) {
  errors.push("Expected 224 manifest assets");
}
if (groups.reduce((sum, [, count]) => sum + count, 0) !== manifest.assetCount) {
  errors.push("Group totals disagree with assetCount");
}

const allowedStates = new Set([
  "approved",
  "assets-imported",
  "assets-imported-awaiting-owner-review",
]);
let approvedCount = 0;
let pendingCount = 0;
const knownPaths = new Set();
const knownKeys = new Set();
const counted = new Map();
const newGroups = new Set([
  "high-demand-essentials",
  "indo-chinese-mains-soups",
  "north-indian-rajasthani",
  "regional-restaurant-favorites",
]);

for (const asset of manifest.assets) {
  const key = asset.category + "/" + asset.slug;
  if (!allowedStates.has(asset.state)) errors.push("Unknown approval state: " + key);
  if (asset.state === "approved") {
    approvedCount++;
    if (asset.approvalBasis !== "owner-directed-original-collection-2026-10-23")
      errors.push("Approved art has no recognized owner directive: " + key);
    if (!["indian", "western", "italian"].includes(asset.category))
      errors.push("Pending review batch unexpectedly approved: " + key);
  } else {
    pendingCount++;
  }
  if (knownPaths.has(asset.path)) {
    errors.push("Duplicate path: " + asset.path);
  }
  if (knownKeys.has(key)) {
    errors.push("Duplicate category/slug: " + key);
  }
  knownPaths.add(asset.path);
  knownKeys.add(key);
  counted.set(asset.category, (counted.get(asset.category) ?? 0) + 1);

  if (!Object.hasOwn(manifest.groups, asset.category)) {
    errors.push("Unknown category: " + key);
  }
  const expectedPath = "/assets/food/dishes/" + key + ".png";
  if (asset.path !== expectedPath || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.slug)) {
    errors.push("Noncanonical asset path/slug: " + key);
  }

  const file = join(root, "public", asset.path.slice(1));
  if (!existsSync(file)) {
    errors.push("Missing: " + asset.path);
    continue;
  }

  const bytes = readFileSync(file);
  const signature = bytes.subarray(0, 8).toString("hex");
  if (
    bytes.length < 33 ||
    signature !== "89504e470d0a1a0a" ||
    bytes.toString("ascii", 12, 16) !== "IHDR"
  ) {
    errors.push("Invalid PNG: " + asset.path);
    continue;
  }

  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  const colorType = bytes[25];
  if (
    width !== 360 ||
    height !== 280 ||
    colorType !== 6 ||
    asset.width !== width ||
    asset.height !== height ||
    asset.format !== "image/png"
  ) {
    errors.push("Expected 360x280 RGBA PNG with matching metadata: " + asset.path);
  }
  if (thirdGroups.has(asset.category) && !asset.sha256) {
    errors.push("Missing third-batch SHA-256: " + asset.path);
  }
  const isNewAsset = newGroups.has(asset.category);
  if (isNewAsset && !/^[a-f0-9]{64}$/.test(asset.sha256 ?? "")) {
    errors.push("Missing or malformed SHA-256 for new asset: " + asset.path);
  }
  if (asset.sha256 && createHash("sha256").update(bytes).digest("hex") !== asset.sha256) {
    errors.push("SHA-256 mismatch: " + asset.path);
  }
}

if (
  thirdGroups.size !== 5 ||
  [...thirdGroups].some((category) => manifest.groups[category] !== 10)
) {
  errors.push("Third-batch category totals mismatch");
}

for (const [category, expected] of groups) {
  if (counted.get(category) !== expected) {
    errors.push("Category count mismatch: " + category);
  }
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

const approvedForRuntime = manifest.assets
  .filter((asset) => asset.state === "approved")
  .map(({ label, path, state, slug, category }) => ({ label, path, state, slug, category }));
if (JSON.stringify(runtimeArt) !== JSON.stringify(approvedForRuntime))
  errors.push("Public runtime artwork index differs from approved manifest entries");

if (
  approvedCount !== 36 ||
  pendingCount !== 188 ||
  manifest.approvalSummary?.approvedOriginal !== 36 ||
  manifest.approvalSummary?.pendingOwnerReview !== 188
)
  errors.push("Approved/pending artwork reconciliation mismatch");

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  "Verified 224 named 360x280 RGBA PNG artwork files across " + groups.length + " categories."
);
