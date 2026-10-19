import { expect, test } from "@playwright/test";

const studio = (page: import("@playwright/test").Page) => page.getByTestId("storefront-studio");
const STICKER_NAMES: Record<string, string> = {
  primary: "Primary QR",
  circular: "Circular",
  cling: "Door cling",
  premium: "Premium window",
  hours: "Opening hours",
  compact: "Compact",
};

test("Section 7 replaces the generic CTA and shows six real-demo sticker formats", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const section = studio(page);
  await expect(
    section.getByRole("heading", { name: /Your menu deserves a place in the window/i })
  ).toBeVisible();
  await expect(section.locator(".ss-format")).toHaveCount(6);
  await expect(section.getByText(/not a sticker purchase or printing service/i)).toBeVisible();
  await expect(section.getByRole("link", { name: /Create your free menu/i })).toHaveAttribute(
    "href",
    "/register"
  );
  await expect(section.getByRole("link", { name: /Explore the live demo/i })).toHaveAttribute(
    "href",
    "/demo"
  );
  await expect(section.getByRole("link", { name: /Open the sample menu/i })).toHaveAttribute(
    "href",
    "https://food.bababuilds.com/m/demo-spice-route-kitchen-v1"
  );
  const qr = section.locator(".ss-real-qr-image img");
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
  await expect(qr).toHaveJSProperty("complete", true);
  await expect(section.getByText("EXAMPLE HOURS", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "Ready to go digital?" })).toHaveCount(0);
});

test("Choosing designs and mounting surfaces updates the actual illustrated storefront", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const section = studio(page);
  await section.scrollIntoViewIfNeeded();
  const stage = section.getByTestId("sticker-stage");
  for (const [name, id] of [
    ["Primary QR", "primary"],
    ["Circular", "circular"],
    ["Door cling", "cling"],
    ["Premium window", "premium"],
    ["Opening hours", "hours"],
    ["Compact", "compact"],
  ] as const) {
    await section.getByRole("radio", { name: new RegExp(name) }).click();
    await expect(stage).toHaveAttribute("data-design", id);
    await expect(section.locator(`.ss-decal-host .ss-sticker--${id}`)).toHaveCount(1);
  }
  // The surface switch belongs directly to the live mockup, not buried in the catalogue.
  const stageBounds = await stage.boundingBox();
  if (!stageBounds) throw new Error("Storefront stage did not render");
  for (const format of ["primary", "circular", "cling", "premium", "hours", "compact"]) {
    await section.getByRole("radio", { name: new RegExp(STICKER_NAMES[format]) }).click();
    const sticker = await stage.locator(".ss-decal-host").boundingBox();
    if (!sticker) throw new Error(`Missing ${format} storefront decal`);
    expect(sticker.width / stageBounds.width, `${format} should fit the pane`).toBeLessThan(0.27);
  }
  const placement = section.locator(".ss-preview-controls");
  await expect(placement.getByText("SEE IT IN PLACE")).toBeVisible();
  await expect(placement.getByRole("radio")).toHaveCount(3);
  const scene = stage.locator(".ss-scene");
  await expect(scene.getByText("WELCOME TO")).toHaveCount(1);
  await expect(scene.getByText("YOUR RESTAURANT")).toHaveCount(1);
  for (const [name, id] of [
    ["Glass door", "door"],
    ["Countertop", "counter"],
    ["Window", "window"],
  ] as const) {
    await section.getByRole("radio", { name, exact: true }).click();
    await expect(stage).toHaveAttribute("data-mount", id);
    await expect(stage.locator(".ss-scene-label")).toContainText(name);
    await expect(section.getByRole("radio", { name, exact: true })).toHaveAttribute(
      "aria-checked",
      "true"
    );
  }
});

test("Finite introduction can pause, replay and stop on user interaction", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const section = studio(page);
  await section.getByTestId("sticker-stage").scrollIntoViewIfNeeded();
  await expect(section).toHaveAttribute("data-intro", "running", { timeout: 5000 });
  await section.getByRole("button", { name: "Pause storefront introduction" }).click();
  await expect(section).toHaveAttribute("data-intro", "paused");
  await section.getByRole("button", { name: "Resume storefront introduction" }).click();
  await expect(section).toHaveAttribute("data-intro", "running");
  await section.getByRole("radio", { name: /Circular/i }).click();
  await expect(section).toHaveAttribute("data-intro", "done");
  await section.getByRole("button", { name: "Replay storefront introduction" }).click();
  await expect(section).toHaveAttribute("data-intro", "running", { timeout: 5000 });
});

test("Reduced-motion, theming and narrow widths preserve a usable sticker studio", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    const section = studio(page);
    await section.scrollIntoViewIfNeeded();
    await expect(section).toHaveAttribute("data-intro", "done");
    await expect(
      section.getByRole("button", { name: "Replay storefront introduction" })
    ).toBeDisabled();
    await expect(section.getByRole("radio", { name: /Premium window/i })).toBeVisible();
    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await expect
      .poll(() =>
        section.evaluate((el) => getComputedStyle(el).getPropertyValue("--ss-scene-back").trim())
      )
      .toBe("#211915");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(1);
  }
});
