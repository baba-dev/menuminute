import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const directory = join(process.cwd(), "public/brand/orders/service-counter");
const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));
const expected = [
  "hero-desktop-light.webp",
  "hero-desktop-dark.webp",
  "hero-mobile-light.webp",
  "hero-mobile-dark.webp",
  "service-bell.webp",
  "ticket-stack.webp",
  "service-complete.webp",
];

if (
  !Array.isArray(manifest.assets) ||
  manifest.assets.length !== expected.length ||
  JSON.stringify(manifest.assets.map(({ filename }) => filename)) !== JSON.stringify(expected)
) {
  throw new Error("Service Counter manifest must declare the seven expected files in order.");
}

const actual = (await readdir(directory)).filter((name) => name.endsWith(".webp")).sort();
if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
  throw new Error(
    "Service Counter requires exactly seven uploaded WebPs. Expected: " +
      expected.join(", ") +
      "; found: " +
      (actual.join(", ") || "(none)")
  );
}

for (const asset of manifest.assets) {
  if (!/^[a-z0-9-]+\.webp$/.test(asset.filename)) {
    throw new Error("Invalid filename: " + asset.filename);
  }
  if (
    !Number.isInteger(asset.width) ||
    !Number.isInteger(asset.height) ||
    typeof asset.transparent !== "boolean"
  ) {
    throw new Error("Invalid manifest specification for " + asset.filename);
  }
  const bytes = await readFile(join(directory, asset.filename));
  const info = await sharp(bytes).metadata();
  if (
    info.format !== "webp" ||
    info.width !== asset.width ||
    info.height !== asset.height ||
    Boolean(info.hasAlpha) !== asset.transparent ||
    bytes.length === 0
  ) {
    throw new Error("Format, dimensions or alpha mismatch: " + asset.filename);
  }
  if (asset.transparent) {
    const { channels } = await sharp(bytes).stats();
    if (channels.length < 4 || channels[3].min === 255) {
      throw new Error("Spot artwork needs actual transparent pixels: " + asset.filename);
    }
  }
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (asset.bytes !== null && asset.bytes !== bytes.length) {
    throw new Error("Size mismatch: " + asset.filename);
  }
  if (asset.sha256 !== null && asset.sha256 !== digest) {
    throw new Error("SHA-256 mismatch: " + asset.filename);
  }
  if (bytes.length > 2_000_000) {
    throw new Error("Please optimize oversized WebP (2 MB limit): " + asset.filename);
  }
  console.log(
    "PASS",
    asset.filename,
    info.width + "x" + info.height,
    asset.transparent ? "alpha" : "opaque",
    "bytes=" + bytes.length,
    "sha256=" + digest
  );
}

if (
  manifest.status === "READY_FOR_REVIEW" &&
  manifest.assets.some(
    (a) => !Number.isInteger(a.bytes) || a.bytes <= 0 || !/^[a-f0-9]{64}$/.test(a.sha256 ?? "")
  )
) {
  throw new Error("READY_FOR_REVIEW requires locked byte counts and hashes for all assets.");
}
console.log("SERVICE_COUNTER_MEDIA_VALIDATED: 7/7");
