import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(process.cwd(), "public", "brand");
const read = (path: string) => readFileSync(join(root, path), "utf8");

describe("approved branding", () => {
  it("ships both self-contained one-shot reveal animations and cropped nav versions", () => {
    for (const theme of ["light", "dark"]) {
      const full = read(`motion/reveal-${theme}-transparent.svg`);
      const nav = read(`motion/nav-${theme}-transparent.svg`);
      const still = read(`logos/nav-${theme}-static.svg`);
      expect(full).toContain("animation-fill-mode:both");
      expect(full).toContain("animation-duration:2.4s");
      expect(full).toContain("@media(prefers-reduced-motion:reduce)");
      expect(full).not.toContain('href="http');
      expect(nav).toContain('viewBox="140 81 650 159"');
      expect(still).toContain("<svg");
      expect(still).not.toContain("animation:");
    }
  });

  it("keeps print artwork as templates and never ships a fake live QR payload", () => {
    for (const type of ["primary-portrait", "circular", "door-cling", "premium-window"]) {
      const asset = read(`print/sticker-${type}.svg`);
      expect(asset).toContain("LIVE QR");
      expect(asset).toContain("INSERT AT PRINT TIME");
    }
    expect(read("print/sticker-opening-hours.svg")).toContain("Add generated QR before printing");
  });
});
