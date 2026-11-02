import { expect, test } from "@playwright/test";

test("public menu refresh renders guest-facing outlet profile without losing dishes", async ({
  page,
}) => {
  const token = "demo-spice-route-kitchen-v1";
  await page.goto("/m/" + token);
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();
  await page.route("**/api/public-menu/" + token + "**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        outlet: {
          ...body.outlet,
          profile: {
            description: "Fresh food from our neighborhood kitchen.",
            phone: "+91 98765 43210",
            email: "guest@example.com",
            website: "https://example.com",
            addressLine1: "Main Road",
            addressLine2: null,
            city: "Pilani",
            state: "Rajasthan",
            postalCode: null,
            country: "IN",
            latitude: 28.36,
            longitude: 75.6,
            primaryColor: null,
            secondaryColor: null,
          },
        },
      }),
    });
  });
  const result = page.waitForResponse(
    (res) => res.url().includes("/api/public-menu/" + token) && res.status() === 200
  );
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await result;
  const section = page.getByRole("region", { name: "Restaurant contact and location" });
  await expect(section.getByText("Main Road, Pilani, Rajasthan")).toBeVisible();
  await expect(section.getByRole("link", { name: "Call" })).toHaveAttribute(
    "href",
    "tel:+919876543210"
  );
  await expect(section.getByRole("link", { name: "Website" })).toHaveAttribute(
    "href",
    "https://example.com/"
  );
  await expect(section.getByRole("link", { name: "Directions" })).toHaveAttribute(
    "href",
    "https://www.google.com/maps/search/?api=1&query=28.36,75.6"
  );
  await expect(page.getByRole("heading", { name: "Paneer Tikka" })).toBeVisible();
});
