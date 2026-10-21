import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const directory = join(process.cwd(), "public/brand/menu-studio/recipe-atelier");
const manifest = JSON.parse(await readFile(join(directory, "manifest.json"), "utf8"));

if (!Array.isArray(manifest.assets) || manifest.assets.length !== 7) {
  throw new Error("Recipe Atelier requires exactly seven declared assets");
}

for (const asset of manifest.assets) {
  if (!/^[a-z0-9-]+\.webp$/.test(asset.filename)) {
    throw new Error("Invalid asset filename: " + asset.filename);
  }
  const path = join(directory, asset.filename);
  const [bytes, details] = await Promise.all([readFile(path), stat(path)]);
  const info = await sharp(bytes).metadata();
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (
    info.format !== "webp" ||
    info.width !== asset.width ||
    info.height !== asset.height ||
    Boolean(info.hasAlpha) !== asset.transparent ||
    details.size !== asset.bytes ||
    digest !== asset.sha256
  ) {
    throw new Error("Media mismatch: " + asset.filename);
  }
  console.log("PASS", asset.filename, info.width + "x" + info.height, details.size + " bytes");
}
console.log("RECIPE_ATELIER_MEDIA_VALIDATED: 7/7");
