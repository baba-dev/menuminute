import { test, expect } from "@playwright/test";

test("production homepage applies Tailwind utilities and responsive navigation", async ({
  page,
}) => {
  await page.goto("/");

  // Text-only smoke checks pass even when the Tailwind compiler is disconnected.
  const action = page.getByRole("link", { name: "Create your free menu", exact: true }).first();
  // A flex item is blockified: the inline-flex utility computes to flex here.
  // Keep checking the generated utility styles, not the authored display token.
  await expect(action).toHaveClass(/\binline-flex\b/);
  await expect(action).toHaveCSS("display", "flex");
  await expect(action).toHaveCSS("padding-top", "16px");
  await expect(action).toHaveCSS("padding-left", "32px");
  await expect(action).toHaveCSS("border-radius", "16px");
  await expect(action).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(action).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");

  const heading = page.getByRole("heading", { level: 1 });
  const width = page.viewportSize()!.width;
  await expect(heading).toHaveCSS(
    "font-size",
    width >= 1024 ? "60px" : width >= 640 ? "48px" : "36px"
  );
  const mobileAction = page
    .getByRole("navigation")
    .getByRole("link", { name: "Get started", exact: true });
  const desktopAction = page
    .getByRole("navigation")
    .getByRole("link", { name: "Get started free", exact: true });
  if (width < 768) {
    await expect(mobileAction).toBeVisible();
    await expect(desktopAction).toBeHidden();
  } else {
    await expect(mobileAction).toBeHidden();
    await expect(desktopAction).toBeVisible();
  }

  await page.getByLabel("Appearance", { exact: true }).selectOption("dark");
  await expect(page.getByRole("navigation")).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await expect(heading).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(action).toHaveCSS("display", "flex");
  await page.reload();
  await expect(page.getByRole("navigation")).toHaveCSS("background-color", "rgb(32, 32, 32)");
  await page.getByLabel("Appearance", { exact: true }).selectOption("light");
  await expect(heading).not.toHaveCSS("color", "rgb(255, 255, 255)");
});
