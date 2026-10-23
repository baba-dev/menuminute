import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const manifest = JSON.parse(
  readFileSync(join(root, "docs/public-menu-assets/manifest.json"), "utf8")
);
const strict = process.argv.includes("--strict");
const errors = [];
const missing = [];
const paths = new Set();

if (manifest.assetCount !== 10 || manifest.assets.length !== manifest.assetCount) {
  errors.push("Expected exactly ten manifest assets");
}

for (const asset of manifest.assets) {
  const expectedSubdir = asset.kind === "cover" ? "covers" : "categories";
  const expectedPath = `public/assets/public-menu/${expectedSubdir}/${asset.id}.webp`;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(asset.id) || asset.repoFile !== expectedPath) {
    errors.push(`Invalid canonical asset path: ${asset.id}`);
    continue;
  }
  if (paths.has(asset.repoFile)) {
    errors.push(`Duplicate manifest path: ${asset.repoFile}`);
    continue;
  }
  paths.add(asset.repoFile);

  const file = resolve(root, asset.repoFile);
  if (!existsSync(file)) {
    missing.push(asset.repoFile);
    if (strict) errors.push(`Missing asset: ${asset.repoFile}`);
    continue;
  }

  const bytes = readFileSync(file);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== asset.sha256) errors.push(`SHA-256 mismatch: ${asset.repoFile}`);
  if (statSync(file).size !== asset.bytes) errors.push(`Byte-size mismatch: ${asset.repoFile}`);

  try {
    const metadata = await sharp(bytes).metadata();
    if (
      metadata.format !== "webp" ||
      metadata.width !== asset.width ||
      metadata.height !== asset.height ||
      Boolean(metadata.hasAlpha) !== asset.alpha
    ) {
      errors.push(`Invalid format/dimensions/alpha: ${asset.repoFile}`);
    }
  } catch {
    errors.push(`Unreadable image: ${asset.repoFile}`);
  }
}

if (errors.length) {
  for (const issue of errors) console.error(issue);
  process.exitCode = 1;
} else if (missing.length) {
  console.log(`Asset scaffold valid: ${missing.length} expected image(s) not yet uploaded.`);
  console.log("After uploading the ZIP contents, run with --strict.");
} else {
  console.log("All 10 MenuMinute public-menu assets passed SHA-256 and media validation.");
}
