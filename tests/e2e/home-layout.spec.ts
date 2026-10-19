import { expect, test } from "@playwright/test";

const shells = [
  ".mj-container", ".ma-container", ".oc-container", ".cp-container",
  ".mm6-container", ".ss-container", ".mmf-container",
];
const titles = [
  ".mj-intro h2", ".ma-intro h2", ".oc-intro h2",
  ".cp-intro h2", ".mm6-header h2", ".ss-header h2",
];

for (const width of [320, 375, 390, 768, 1024, 1440, 1920]) {
  test(`homepage editorial grid and footer align at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const dimensions = await page.evaluate(({ shells, titles }) => {
      const measures = shells.map((selector) => {
        const node = document.querySelector<HTMLElement>(selector);
        if (!node) throw new Error(`Missing shell: ${selector}`);
        const rect = node.getBoundingClientRect();
        return { selector, left: rect.left, right: rect.right, width: rect.width };
      });
      const heroNav = document.querySelector<HTMLElement>(".food-orbit-hero__nav > div");
      const heroBody = document.querySelector<HTMLElement>(".food-orbit-hero__content");
      if (!heroNav || !heroBody) throw new Error("Missing hero grid");
      const innerLeft = (node: HTMLElement) =>
        node.getBoundingClientRect().left + parseFloat(getComputedStyle(node).paddingLeft);
      const typeSizes = titles.map((selector) => {
        const node = document.querySelector<HTMLElement>(selector);
        if (!node) throw new Error(`Missing title: ${selector}`);
        return parseFloat(getComputedStyle(node).fontSize);
      });
      return {
        measures, navLeft: innerLeft(heroNav), heroLeft: innerLeft(heroBody),
        typeSizes,
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    }, { shells, titles });
    const baseline = dimensions.measures[0];
    for (const measure of dimensions.measures) {
      expect(Math.abs(measure.left - baseline.left), measure.selector).toBeLessThanOrEqual(1.5);
      expect(Math.abs(measure.right - baseline.right), measure.selector).toBeLessThanOrEqual(1.5);
    }
    expect(Math.abs(dimensions.navLeft - baseline.left)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(dimensions.heroLeft - baseline.left)).toBeLessThanOrEqual(1.5);
    expect(Math.max(...dimensions.typeSizes) - Math.min(...dimensions.typeSizes)).toBeLessThanOrEqual(1.5);
    expect(dimensions.overflow).toBeLessThanOrEqual(1);
    await expect(page.getByTestId("public-footer")).toHaveCount(1);
  });
}

test("homepage layout stays scoped and does not alter other public pages", async ({ page }) => {
  await page.goto("/pricing");
  await expect(page.locator(".mm-homepage")).toHaveCount(0);
  await expect(page.getByTestId("public-footer")).toHaveCount(1);
});
