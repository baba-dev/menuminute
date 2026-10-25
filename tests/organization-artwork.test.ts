import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { describe, expect, it } from "vitest";

const root = join(process.cwd(), "public/brand/organization/hospitality-house");
const manifest = JSON.parse(readFileSync(join(root, "manifest.json"), "utf8")) as {
  assets: Array<{
    path: string;
    width: number;
    height: number;
    bytes: number;
    blobSha: string;
    format: "png" | "webp";
    hasAlpha: boolean;
  }>;
};

const expectedHeroNames = [
  "Organization-Hero-Light.png",
  "Organization-Hero-Dark.png",
  "Organization-Hero-Mobile-Light.png",
  "Organization-Hero-Mobile-Dark.png",
];
const expectedIllustrationNames = [
  "outlet-collection-light.webp",
  "outlet-collection-dark.webp",
  "team-hall-light.webp",
  "team-hall-dark.webp",
  "brand-gallery-light.webp",
  "brand-gallery-dark.webp",
  "capabilities-light.webp",
  "capabilities-dark.webp",
  "activity-light.webp",
  "activity-dark.webp",
  "owners-office-light.webp",
  "owners-office-dark.webp",
];

describe("Hospitality House approved production artwork", () => {
  it("ships exactly the approved four hero files and twelve theme-paired illustrations", () => {
    expect(readdirSync(root).filter((name) => /\.(png|webp)$/i.test(name)).sort()).toEqual(
      [...expectedHeroNames].sort()
    );
    expect(readdirSync(join(root, "illustrations")).filter((name) => /\.(png|webp)$/i.test(name)).sort())
      .toEqual([...expectedIllustrationNames].sort());
    expect(manifest.assets.map((asset) => asset.path).sort()).toEqual([
      ...expectedHeroNames,
      ...expectedIllustrationNames.map((name) => "illustrations/" + name),
    ].sort());
    expect(manifest.assets).toHaveLength(16);
  });

  it.each(manifest.assets)("matches the approved source blob and verified dimensions: $path", async (asset) => {
    const bytes = await readFile(join(root, asset.path));
    const gitSha = createHash("sha1")
      .update(Buffer.from("blob " + bytes.length + "\0"))
      .update(bytes)
      .digest("hex");
    expect(bytes.length).toBe(asset.bytes);
    expect(gitSha).toBe(asset.blobSha);
    const metadata = await sharp(bytes).metadata();
    expect(metadata.format).toBe(asset.format);
    expect(metadata.width).toBe(asset.width);
    expect(metadata.height).toBe(asset.height);
    expect(metadata.hasAlpha).toBe(false);
  });

  it("excludes superseded desktop/mobile WebPs and intermediate PNG sources", () => {
    for (const name of [
      "hero-desktop-light.webp",
      "hero-desktop-dark.webp",
      "hero-mobile-light.webp",
      "hero-mobile-dark.webp",
      "illustrations/outlet-collection.png",
      "illustrations/team_hall.png",
    ]) {
      expect(existsSync(join(root, name)), name + " must not ship").toBe(false);
    }
  });
});
