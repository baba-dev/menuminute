import { expect, test } from "@playwright/test";

test("public pricing advertises the four INR tiers without unsupported international checkout", async ({
  page,
}) => {
  await page.goto("/pricing");
  await expect(page.getByRole("heading", { name: "Simple, honest pricing." })).toBeVisible();
  for (const name of ["Free", "Ordering", "Kitchen Pro", "Dedicated"])
    await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();

  for (const price of ["₹0", "₹119", "₹499", "₹30,000"])
    await expect(page.getByText(price, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("One flat price for up to 10 outlets")).toBeVisible();
  // The footnote must agree with the buttons: it only mentions live checkout when checkout is open.
  await expect(
    page.getByText(
      /Current self-service checkout charges in INR|Self-service paid checkout is not open yet/
    )
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Subscription pricing currency" })
  ).toBeVisible();
  await expect(page.getByText("Virtually unlimited").first()).toBeVisible();
  await expect(page.getByRole("table", { name: /Limits and features/ })).toBeVisible();
  await expect(page.locator("body")).not.toContainText(
    /Limited rollout|feature-gated|approved operator activation|release approval/
  );
  await expect(page.locator("body")).not.toContainText("Free AI paper menu photo scanner");
  await expect(page.getByText("TBA", { exact: true })).toHaveCount(0);
  await expect(page.locator('a[href="#"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Get started free" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
  // Paid-plan buttons follow the deployment's real payment switches (data-sale-state), never a
  // blanket "/register": a purchasable plan opens its Billing card, anything else is honest about it.
  const saleHref = async (plan: "ordering" | "kitchen_pro") => {
    const card = page.locator(`[data-plan="${plan}"]`);
    const state = await card.getAttribute("data-sale-state");
    return { state, cta: card.locator("a[data-sale-cta]") };
  };
  const ordering = await saleHref("ordering");
  expect(["checkout", "opening_soon"]).toContain(ordering.state);
  await expect(ordering.cta).toHaveAttribute(
    "href",
    ordering.state === "checkout" ? "/login?next=%2Fbilling%3Fplan%3Dordering" : "/register"
  );
  const kitchen = await saleHref("kitchen_pro");
  expect(["checkout", "early_access"]).toContain(kitchen.state);
  await expect(kitchen.cta).toHaveAttribute(
    "href",
    kitchen.state === "checkout"
      ? "/login?next=%2Fbilling%3Fplan%3Dkitchen_pro"
      : "/contact?topic=kitchen-pro"
  );
  await expect(page.getByRole("link", { name: /Talk to us about Dedicated/ })).toHaveAttribute(
    "href",
    "/contact"
  );
  await expect(page.getByText(/under the MIT License/)).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/\$19\/mo|\$39\/mo|₹299/);
});

test("homepage presents ordering and the kitchen as available, with their real prices", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByTestId("order-conveyor")).toContainText("AVAILABLE NOW");
  await expect(page.getByTestId("order-conveyor")).toContainText("₹119");
  await expect(page.getByTestId("chef-pass")).toContainText("AVAILABLE NOW");
  await expect(page.getByTestId("chef-pass")).toContainText("₹499");
  await expect(page.getByTestId("service-worlds")).toContainText("AVAILABLE TODAY");
  for (const id of ["order-conveyor", "chef-pass", "service-worlds"])
    await expect(page.getByTestId(id)).not.toContainText(/in development|coming later|planned/i);
  await expect(page.locator("body")).not.toContainText(/₹299/);
  await expect(page.getByRole("link", { name: "Create your free menu" }).first()).toHaveAttribute(
    "href",
    "/register"
  );
});

test("international USD price book is published but cannot open INR checkout", async ({ page }) => {
  await page.goto("/pricing?currency=USD");
  for (const price of ["$0", "$5.00", "$20.00", "$3,000.00"])
    await expect(page.getByText(price, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dedicated · On-premise Private" })).toBeVisible();
  await expect(page.getByText("Private on-premise deployment", { exact: true })).toBeVisible();
  await expect(page.getByText(/USD checkout is not yet active/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Ask about USD billing" })).toHaveCount(2);
  for (const link of await page.getByRole("link", { name: "Ask about USD billing" }).all())
    await expect(link).toHaveAttribute("href", "/contact");
  await expect(page.getByRole("link", { name: "Discuss private deployment" })).toHaveAttribute(
    "href",
    "/contact"
  );
});

test("every pricing button leads to a working page in both currencies", async ({
  page,
  request,
}) => {
  for (const currency of ["INR", "USD"]) {
    await page.goto(`/pricing?currency=${currency}`);
    const hrefs = await page
      .locator("a[data-sale-cta]")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    expect(hrefs, currency).toHaveLength(4);
    for (const href of hrefs) {
      expect(href, currency).toMatch(/^\/[a-z]/);
      const response = await request.get(href!);
      expect(response.status(), `${currency} ${href}`).toBeLessThan(400);
    }
  }
});

test("sign-in and sign-up carry a Billing return path, which is how pricing buttons reach a plan", async ({
  page,
}) => {
  // Anonymous visitors are sent to sign-in with the Billing card as the return path (see planSale).
  await page.goto("/login?next=%2Fbilling%3Fplan%3Dkitchen_pro");
  await expect(page.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
    "href",
    "/register?next=%2Fbilling%3Fplan%3Dkitchen_pro"
  );
  // The return path must stay on this site's own pages.
  await page.goto("/login?next=https%3A%2F%2Fevil.example%2Fbilling");
  await expect(page.getByRole("link", { name: "Create a free account" })).toHaveAttribute(
    "href",
    "/register"
  );
});

test("Kitchen Pro early access opens a pre-filled enquiry, and unknown topics are ignored", async ({
  page,
}) => {
  await page.goto("/contact?topic=kitchen-pro");
  const topic = page.getByTestId("contact-topic");
  await expect(topic).toContainText("Request Kitchen Pro early access");
  await expect(topic.getByRole("link")).toHaveAttribute(
    "href",
    "mailto:admin@bababuilds.com?subject=Kitchen%20Pro%20early%20access"
  );
  await page.goto("/contact?topic=%3Cscript%3E");
  await expect(page.getByTestId("contact-topic")).toHaveCount(0);
});

test("the conventional /support URL leads to the help centre", async ({ page }) => {
  await page.goto("/support");
  await expect(page).toHaveURL(/\/help$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("How can we help");
});
