import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const directory = join(process.cwd(), "public/brand/dashboard/editorial");

for (const mode of ["light", "dark"]) {
  const input = join(directory, "hero-mobile-" + mode + ".webp.png");
  const output = join(directory, "hero-mobile-" + mode + ".webp");
  if (!existsSync(input)) {
    throw new Error("Missing approved mobile dashboard source: " + input);
  }
  mkdirSync(directory, { recursive: true });
  const metadata = await sharp(input).metadata();
  if (metadata.format !== "png") {
    throw new Error("Unexpected mobile source format for " + input + ": " + metadata.format);
  }
  const result = await sharp(input)
    .resize(960, 1120, { fit: "cover", position: "centre" })
    .webp({ quality: 78, effort: 6, smartSubsample: true })
    .toFile(output);
  if (result.format !== "webp" || result.width !== 960 || result.height !== 1120) {
    throw new Error("Unexpected dashboard mobile export: " + output);
  }
  console.log("Prepared " + output + " (" + result.size + " bytes)");
}

for (const file of [
  "hero-desktop-light.webp",
  "hero-desktop-dark.webp",
  "priorities-illustration.webp",
  "outlet-health-illustration.webp",
]) {
  const source = join(directory, file);
  const info = await sharp(source).metadata();
  if (info.format !== "webp") {
    throw new Error("Approved editorial media must be WebP: " + file);
  }
}
