import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const MENU = "/m/demo-spice-route-kitchen-v1";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Violation = { id: string; impact?: string | null; nodes: { target: unknown }[] };

/**
 * Serious/critical violations fail the test. Colour contrast is reported as an
 * annotation until the owner's visual QA signs off both themes, so it stays visible
 * in the report without blocking unrelated PRs.
 */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = (results.violations as Violation[]).filter(
    (v) => (v.impact === "serious" || v.impact === "critical") && v.id !== "color-contrast"
  );
  const contrast = (results.violations as Violation[]).find((v) => v.id === "color-contrast");
  if (contrast) {
    test.info().annotations.push({
      type: "color-contrast",
      description: `${label}: ${contrast.nodes.length} element(s) below WCAG AA contrast`,
    });
  }
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.nodes.length} node(s)`),
    `${label}: axe violations`
  ).toEqual([]);
}

for (const colorScheme of ["light", "dark"] as const) {
  test(`public menu has no serious axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(MENU);
    await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();
    await audit(page, `menu ${colorScheme}`);
  });

  test(`dish details dialog has no serious axe violations (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto(MENU);
    await page.getByRole("button", { name: "View Paneer Tikka details" }).first().click();
    await expect(page.getByRole("dialog", { name: "Paneer Tikka" })).toBeVisible();
    await audit(page, `dialog ${colorScheme}`);
  });
}
