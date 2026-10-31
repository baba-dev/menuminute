import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const MENU = "/m/demo-spice-route-kitchen-v1";
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

type Violation = { id: string; impact?: string | null; nodes: { target: unknown }[] };

/** Serious/critical axe violations fail the test, including colour contrast. */
async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  const blocking = (results.violations as Violation[]).filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );
  expect(
    blocking.map((v) =>
      `${v.id} (${v.impact}): ${v.nodes.length} node(s); targets: ${v.nodes
        .slice(0, 3)
        .map((n) => JSON.stringify(n.target))
        .join(", ")}`
    ),
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
