import { readFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import sharp from "sharp";

const directory = join(process.cwd(), "public/brand/orders/service-counter");
await mkdir(directory, { recursive: true });
for (const theme of ["light", "dark"]) {
  const input = join(directory, "hero-desktop-" + theme + ".png");
  const output = join(directory, "hero-desktop-" + theme + ".webp");
  const source = await readFile(input);
  const metadata = await sharp(source).metadata();
  if (metadata.format !== "png" || !metadata.width || !metadata.height ||
      metadata.width < 1400 || metadata.height < 350) {
    throw new Error("Expected a genuine desktop PNG master: " + input);
  }
  const ratio = metadata.width / metadata.height;
  if (ratio < 2.4 || ratio > 4.8) {
    throw new Error("Desktop artwork must be panoramic. Received " +
      metadata.width + "x" + metadata.height + ": " + input);
  }
  await sharp(source)
    .resize(2880, 800, { fit: "cover", position: "centre" })
    .webp({ quality: 83, effort: 5, alphaQuality: 100 })
    .toFile(output);
  const outBytes = await readFile(output);
  const outputInfo = await sharp(outBytes).metadata();
  if (outputInfo.format !== "webp" || outputInfo.width !== 2880 || outputInfo.height !== 800 ||
      outputInfo.hasAlpha || outBytes.length > 2_000_000) {
    throw new Error("Generated Orders hero is invalid: " + output);
  }
  console.log("ORDER_HERO_GENERATED", theme, "sourceSha256=" +
    createHash("sha256").update(source).digest("hex"), "outputSha256=" +
    createHash("sha256").update(outBytes).digest("hex"), "bytes=" + outBytes.length);
}
