import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const directory = join(process.cwd(), "public/brand/qr-studio/tabletop-press");
const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));

if (!Array.isArray(manifest.assets) || manifest.assets.length !== 7) {
  throw new Error("Tabletop Press requires exactly seven declared media assets.");
}
const listed = await readdir(directory);
const actualWebps = listed.filter((entry) => entry.endsWith(".webp")).sort();
const expectedWebps = manifest.assets.map((asset) => asset.filename).sort();
if (JSON.stringify(actualWebps) !== JSON.stringify(expectedWebps)) {
  throw new Error("Uploaded WebP inventory does not match the seven-file manifest.");
}

for (const asset of manifest.assets) {
  if (!/^[a-z0-9-]+\.webp$/.test(asset.filename)) {
    throw new Error("Invalid media asset filename: " + asset.filename);
  }
  const filePath = join(directory, asset.filename);
  const [bytes, fileStat] = await Promise.all([readFile(filePath), stat(filePath)]);
  const info = await sharp(bytes).metadata();
  const digest = createHash("sha256").update(bytes).digest("hex");

  if (
    info.format !== "webp" ||
    info.width !== asset.width ||
    info.height !== asset.height ||
    Boolean(info.hasAlpha) !== asset.transparent ||
    fileStat.size !== asset.bytes ||
    digest !== asset.sha256
  ) {
    throw new Error(
      "QR Studio media checksum, format, dimensions or alpha mismatch: " + asset.filename
    );
  }

  console.log(
    "PASS",
    asset.filename,
    info.width + "x" + info.height,
    asset.transparent ? "transparent" : "opaque",
    fileStat.size + " bytes"
  );
}

console.log("TABLETOP_PRESS_MEDIA_VALIDATED: 7/7");
