import { expect, test } from "@playwright/test";

test("Section 6 replaces the pricing cards with the approved service-worlds story", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const section = page.getByTestId("service-worlds");
  await expect(section.getByRole("heading", { name: /Different kitchens/i })).toBeVisible();
  await expect(section.locator("svg[data-mm6]")).toHaveAttribute("data-mode", "dine");
  await expect(section.getByText(/No real scan, order or payment takes place/)).toBeVisible();
  await expect(section.getByRole("link", { name: /Create your free menu/i })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(section.getByRole("link", { name: /Explore the live QR demo/i })).toHaveAttribute(
    "href",
    "/demo"
  );
  await expect(page.locator(".ma-product-features")).toHaveCount(0);
  const ordering = await page.evaluate(() => {
    const chef = document.querySelector(".chef-pass");
    const worlds = document.querySelector(".service-worlds");
    return Boolean(
      chef && worlds && chef.compareDocumentPosition(worlds) & Node.DOCUMENT_POSITION_FOLLOWING
    );
  });
  expect(ordering).toBe(true);
});

test("Every world changes both the physical illustration and the matching phone menu", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const section = page.getByTestId("service-worlds");
  await section.scrollIntoViewIfNeeded();
  const svg = section.locator("svg[data-mm6]");
  for (const [label, mode, message] of [
    ["Takeout", "take", "PICKUP ORDERING · IN DEVELOPMENT"],
    ["Cloud kitchen", "cloud", "CONNECTED WORKFLOWS · IN DEVELOPMENT"],
    ["Dine-in", "dine", "FREE QR MENU · AVAILABLE TODAY"],
  ] as const) {
    await section.getByRole("button", { name: label, exact: true }).click();
    await expect(svg).toHaveAttribute("data-mode", mode);
    await expect(section.getByRole("button", { name: label, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    await expect(section.getByText(message)).toBeVisible();
  }
  await expect(section.getByRole("button", { name: "Replay introduction" })).toBeDisabled();
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  await expect(svg).toHaveClass(/theme-dark/);
});

test("Desktop introduction is user-controlled and pauses offscreen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const section = page.getByTestId("service-worlds");
  await section.scrollIntoViewIfNeeded();
  const svg = section.locator("svg[data-mm6]");
  await section.getByRole("button", { name: "Replay introduction" }).click();
  await expect(svg).toHaveClass(/is-intro/);
  await section.getByRole("button", { name: "Pause introduction" }).click();
  await expect(svg).toHaveClass(/paused/);
  await section.getByRole("button", { name: "Resume introduction" }).click();
  await section.getByRole("button", { name: "Takeout", exact: true }).click();
  await expect(svg).toHaveAttribute("data-step", "6");
  await expect(svg).toHaveAttribute("data-mode", "take");
});

test("Narrow screens preserve accessible selectors, appearance and no document overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 760 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const section = page.getByTestId("service-worlds");
  await section.scrollIntoViewIfNeeded();
  await expect(section.getByRole("button", { name: "Cloud kitchen", exact: true })).toBeVisible();
  await expect(section.getByText(/Static composition for smaller screens/)).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth
      )
    )
    .toBeLessThanOrEqual(1);
});
